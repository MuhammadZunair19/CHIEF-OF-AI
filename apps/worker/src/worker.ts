import { Worker } from "bullmq";
import { google } from "googleapis";
import { db, Prisma } from "@chief/database";
import { connection } from "@chief/queue";
import { createProvider } from "@chief/llm";
import {
  googleClient,
  listRecentMessages,
  listUpcomingEvents,
  startGmailWatch,
} from "@chief/google";
import {
  ApprovalPayloadSchema,
  QueueJobSchema,
  type QueueJob,
} from "@chief/contracts";
const event = (
  userId: string,
  type: string,
  message: string,
  runId?: string,
  data?: Record<string, unknown>,
) =>
  db.eventRecord.create({
    data: {
      userId,
      type,
      message,
      ...(runId ? { runId } : {}),
      ...(data ? { data: data as Prisma.InputJsonValue } : {}),
    },
  });
async function authFor(userId: string) {
  const account = await db.account.findFirst({
    where: { userId, providerId: "google" },
  });
  if (!account) throw new Error("Google account is not connected");
  return googleClient({
    ...(account.accessToken ? { accessToken: account.accessToken } : {}),
    ...(account.refreshToken ? { refreshToken: account.refreshToken } : {}),
  });
}
async function sync(userId: string) {
  const auth = await authFor(userId),
    [messages, events] = await Promise.all([
      listRecentMessages(auth),
      listUpcomingEvents(auth),
    ]);
  for (const item of events)
    await db.calendarEvent.upsert({
      where: {
        userId_googleEventId: { userId, googleEventId: item.googleEventId },
      },
      update: item,
      create: { userId, ...item },
    });
  for (const message of messages)
    await db.email.upsert({
      where: {
        userId_gmailMessageId: {
          userId,
          gmailMessageId: message.gmailMessageId,
        },
      },
      update: { unread: message.unread, preview: message.preview },
      create: {
        userId,
        ...message,
        gmailThreadId: message.gmailThreadId ?? null,
      },
    });
  return { messages: messages.length, events: events.length };
}
async function availability(userId: string) {
  const auth = await authFor(userId),
    calendar = google.calendar({ version: "v3", auth }),
    start = new Date(Date.now() + 3600000),
    end = new Date(Date.now() + 7 * 86400000),
    busy =
      (
        await calendar.freebusy.query({
          requestBody: {
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            items: [{ id: "primary" }],
          },
        })
      ).data.calendars?.primary?.busy ?? [];
  const slots: Date[] = [];
  for (let day = 0; day < 7 && slots.length < 3; day++) {
    for (const hour of [10, 11, 14, 15, 16]) {
      const candidate = new Date(start);
      candidate.setUTCDate(start.getUTCDate() + day);
      candidate.setUTCHours(hour, 0, 0, 0);
      const finish = new Date(candidate.getTime() + 30 * 60000);
      if (
        candidate > start &&
        !busy.some(
          (x) => new Date(x.start!) < finish && new Date(x.end!) > candidate,
        )
      )
        slots.push(candidate);
      if (slots.length === 3) break;
    }
  }
  return slots;
}
function emailAddress(value: string) {
  const bracketed = value.match(/<\s*([^<>]+)\s*>/);
  return (bracketed?.[1] ?? value).trim();
}
async function analyze(userId: string, emailId: string) {
  const email = await db.email.findFirstOrThrow({
    where: { id: emailId, userId },
    include: { analysisRecord: true },
  });
  if (email.analysisRecord) return;
  const run = await db.agentRun.create({
    data: {
      userId,
      emailId,
      trigger: "EMAIL_SYNC",
      status: "RUNNING",
      startedAt: new Date(),
      inputSummary: `Analyze ${email.subject}`,
    },
  });
  await event(userId, "agent.run.started", "Analyzing a new email", run.id);
  try {
    await db.agentStep.create({
      data: {
        agentRunId: run.id,
        type: "ANALYSIS",
        title: "Analyzing message",
        status: "RUNNING",
      },
    });
    const settings = await db.userSettings.upsert({
        where: { userId },
        update: {},
        create: { userId },
      }),
      analysis = await createProvider().analyzeEmail({
        subject: email.subject,
        sender: email.sender,
        body: email.bodyText ?? email.preview,
        timezone: settings.timezone,
      });
    await db.emailAnalysis.create({
      data: {
        emailId,
        summary: analysis.summary,
        category: analysis.category,
        priority: analysis.priority,
        requiresAction: analysis.requiresAction,
        schedulingIntent: analysis.schedulingIntent,
        actionItems: analysis.actionItems,
      },
    });
    await event(
      userId,
      "email.analyzed",
      `${analysis.category.toLowerCase()} email analyzed`,
      run.id,
      { emailId },
    );
    for (const item of analysis.actionItems) {
      await db.task.create({
        data: {
          userId,
          emailId,
          title: item.title,
          priority: item.priority,
          source: "EMAIL",
          createdByAi: true,
        },
      });
      await event(userId, "task.created", item.title, run.id);
    }
    if (analysis.schedulingIntent && analysis.suggestedReply) {
      const recipient = emailAddress(email.sender),
        slots = await availability(userId),
        slotText = slots.map((x) => x.toISOString()).join(", "),
        draft = await db.emailDraft.create({
          data: {
            emailId,
            body: `${analysis.suggestedReply}\n\nAvailable options: ${slotText}`,
            recipients: [recipient],
            subject: `Re: ${email.subject}`,
          },
        });
      await db.approvalRequest.create({
        data: {
          userId,
          draftId: draft.id,
          runId: run.id,
          type: "SEND_EMAIL",
          reason: "Reply to a detected scheduling request",
          riskLevel: "HIGH",
          payload: {
            kind: "SEND_EMAIL",
            to: [recipient],
            subject: `Re: ${email.subject}`,
            body: draft.body,
            gmailThreadId: email.gmailThreadId,
          },
          status: "PENDING",
        },
      });
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          status: "WAITING_FOR_APPROVAL",
          resultSummary: "Drafted scheduling reply and requested approval",
        },
      });
      await event(
        userId,
        "approval.created",
        "Draft reply is waiting for approval",
        run.id,
      );
      return;
    }
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        resultSummary: analysis.summary,
      },
    });
    await event(
      userId,
      "agent.run.completed",
      "Email workflow completed",
      run.id,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed";
    await db.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
    await event(
      userId,
      "agent.run.failed",
      "Email analysis is temporarily unavailable",
      run.id,
    );
    throw error;
  }
}
async function execute(userId: string, approvalId: string) {
  const approval = await db.approvalRequest.findFirstOrThrow({
    where: { id: approvalId, userId },
    include: { draft: true },
  });
  if (approval.status === "EXECUTED") return;
  if (approval.status !== "APPROVED")
    throw new Error("Approval is not executable");
  try {
    const rawPayload = approval.payload as {
        kind?: unknown;
        to?: unknown;
        [key: string]: unknown;
      },
      normalizedPayload =
        rawPayload.kind === "SEND_EMAIL" && Array.isArray(rawPayload.to)
          ? {
              ...rawPayload,
              to: rawPayload.to.map((value) =>
                emailAddress(String(value)),
              ),
            }
          : rawPayload,
      payload = ApprovalPayloadSchema.parse(normalizedPayload),
      auth = await authFor(userId);
    if (payload.kind === "SEND_EMAIL") {
      const body = approval.draft?.body ?? payload.body,
        raw = Buffer.from(
          [
            `To: ${payload.to.join(", ")}`,
            `Subject: ${payload.subject}`,
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
          ].join("\r\n"),
        ).toString("base64url");
      await google
        .gmail({ version: "v1", auth })
        .users.messages.send({
          userId: "me",
          requestBody: { raw, threadId: payload.gmailThreadId },
        });
    } else
      await google
        .calendar({ version: "v3", auth })
        .events.insert({
          calendarId: "primary",
          sendUpdates: "all",
          requestBody: {
            summary: payload.title,
            start: { dateTime: payload.start },
            end: { dateTime: payload.end },
            attendees: payload.attendees.map((email) => ({ email })),
          },
        });
    await db.approvalRequest.update({
      where: { id: approval.id },
      data: { status: "EXECUTED", executedAt: new Date() },
    });
    if (approval.runId)
      await db.agentRun.update({
        where: { id: approval.runId },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });
    await event(
      userId,
      "approval.updated",
      "Approved action executed",
      approval.runId ?? undefined,
    );
  } catch (error) {
    await db.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Execution failed",
      },
    });
    throw error;
  }
}
const worker = new Worker<QueueJob>(
  "chief-agent",
  async (job) => {
    const payload = QueueJobSchema.parse(job.data);
    if (payload.name === "gmail.sync") return sync(payload.userId);
    if (payload.name === "email.analyze") {
      if (!String(job.id).startsWith("analyze-manual-"))
        return { skipped: "Automatic email analysis is disabled" };
      return analyze(payload.userId, payload.emailId);
    }
    return execute(payload.userId, payload.approvalId);
  },
  { connection, concurrency: 2, lockDuration: 120000 },
);
worker.on("failed", (job, error) =>
  console.error({ jobId: job?.id, error: error.message }, "Job failed"),
);
worker.on("error", (error) =>
  console.error(
    `[Chief worker] Queue connection unavailable: ${error.message}`,
  ),
);
const renewGmailWatches = async () => {
  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topic) return;
  const expiring = await db.gmailWatch.findMany({ where: { status: "ACTIVE", expiresAt: { lte: new Date(Date.now() + 86400000) } } });
  for (const watch of expiring) {
    try {
      const metadata = await startGmailWatch(await authFor(watch.userId), topic);
      await db.gmailWatch.update({ where: { id: watch.id }, data: metadata });
    } catch (error) {
      await db.gmailWatch.update({ where: { id: watch.id }, data: { status: "RECONNECT_REQUIRED" } });
      console.error({ userId: watch.userId, error: error instanceof Error ? error.message : "Watch renewal failed" }, "Gmail watch renewal failed");
    }
  }
};
const watchRenewal = setInterval(() => void renewGmailWatches(), 12 * 60 * 60 * 1000);
watchRenewal.unref();
const shutdown = async () => {
  clearInterval(watchRenewal);
  await worker.close();
  await connection.quit();
  await db.$disconnect();
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
