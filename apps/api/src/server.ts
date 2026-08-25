import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { auth, sessionFromHeaders } from "./auth.js";
import { db } from "@chief/database";
import { enqueue, connection, agentQueue } from "@chief/queue";
import { integrationState, loadEnv } from "@chief/config";
import { z } from "zod";
import { googleClient, startGmailWatch, verifyGooglePushToken } from "@chief/google";
const env = loadEnv(),
  app = Fastify({
    logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });
await app.register(cors, { origin: env.WEB_URL, credentials: true });
const headers = (raw: Record<string, unknown>) =>
  new Headers(
    Object.entries(raw).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : [],
    ),
  );
app.all("/api/auth/*", async (req, reply) => {
  const url = new URL(req.url, env.BETTER_AUTH_URL);
  const request = new Request(url, {
    method: req.method,
    headers: headers(req.headers),
    body: ["GET", "HEAD"].includes(req.method)
      ? undefined
      : JSON.stringify(req.body),
  });
  const response = await auth.handler(request);
  reply.status(response.status);
  response.headers.forEach((v, k) => reply.header(k, v));
  return reply.send(
    response.body ? Readable.fromWeb(response.body as never) : null,
  );
});
const requireUser = async (
  req: { headers: Record<string, unknown> },
  reply: { code: (n: number) => { send: (x: unknown) => unknown } },
) => {
  const session = await sessionFromHeaders(headers(req.headers));
  if (!session) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }
  return session.user;
};
const googleAuthFor = async (userId: string) => {
  const account = await db.account.findFirst({ where: { userId, providerId: "google" } });
  if (!account) throw new Error("Google account is not connected");
  return googleClient({ ...(account.accessToken ? { accessToken: account.accessToken } : {}), ...(account.refreshToken ? { refreshToken: account.refreshToken } : {}) });
};
app.get("/health", async () => ({ status: "ok" }));
app.get("/ready", async (_req, reply) => {
  try {
    await db.$queryRaw`SELECT 1`;
    await connection.ping();
    return { status: "ready" };
  } catch {
    reply.code(503);
    return { status: "not_ready" };
  }
});
app.get("/api/setup", async () => ({ integrations: integrationState(env) }));
app.get("/api/search", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const query = z
      .object({ q: z.string().trim().min(2).max(100) })
      .parse(req.query),
    contains = { contains: query.q, mode: "insensitive" as const };
  const [emails, tasks] = await Promise.all([
    db.email.findMany({
      where: {
        userId: user.id,
        OR: [{ subject: contains }, { sender: contains }],
      },
      select: { id: true, subject: true, sender: true },
      take: 8,
    }),
    db.task.findMany({
      where: {
        userId: user.id,
        OR: [{ title: contains }, { description: contains }],
      },
      select: { id: true, title: true, status: true },
      take: 8,
    }),
  ]);
  return { emails, tasks };
});
app.get("/api/dashboard", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const now = new Date(),
    dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const [pending, tasksDue, attention, meetings, recent, overdue, todayMeetings, priorityEmails] = await Promise.all([
    db.approvalRequest.count({ where: { userId: user.id, status: "PENDING" } }),
    db.task.count({
      where: {
        userId: user.id,
        status: { notIn: ["DONE", "ARCHIVED"] },
        dueAt: { lte: new Date(Date.now() + 86400000) },
      },
    }),
    db.emailAnalysis.count({
      where: {
        email: { userId: user.id },
        priority: { in: ["HIGH", "URGENT"] },
        requiresAction: true,
      },
    }),
    db.calendarEvent.count({
      where: {
        userId: user.id,
        startAt: { gte: new Date(), lte: new Date(Date.now() + 86400000) },
      },
    }),
    db.agentRun.findMany({
      where: { userId: user.id },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { steps: { take: 1, orderBy: { startedAt: "desc" } } },
    }),
    db.task.findMany({
      where: { userId: user.id, status: { notIn: ["DONE", "ARCHIVED"] }, dueAt: { lt: now } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 4,
    }),
    db.calendarEvent.findMany({
      where: { userId: user.id, startAt: { gte: now, lte: dayEnd } },
      orderBy: { startAt: "asc" },
      take: 6,
    }),
    db.email.findMany({
      where: { userId: user.id, unread: true, analysisRecord: { requiresAction: true } },
      include: { analysisRecord: true },
      orderBy: { receivedAt: "desc" },
      take: 4,
    }),
  ]);
  const meetingMinutes = todayMeetings.reduce((sum, event) => sum + Math.max(0, (event.endAt.getTime() - event.startAt.getTime()) / 60000), 0),
    focusMinutes = Math.max(0, 480 - meetingMinutes),
    dayScore = Math.max(0, Math.min(100, 100 - overdue.length * 12 - pending * 6 - Math.max(0, meetings - 5) * 4));
  return {
    metrics: { pending, tasksDue, attention, meetings },
    recent,
    command: { overdue, meetings: todayMeetings, priorityEmails, focusMinutes: Math.round(focusMinutes), dayScore },
  };
});
app.get("/api/inbox", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  return db.email.findMany({
    where: { userId: user.id, triageStatus: "INBOX", OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }] },
    orderBy: { receivedAt: "desc" },
    take: 50,
    include: { analysisRecord: true, drafts: true },
  });
});
app.patch("/api/inbox/triage", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const body = z.object({ ids: z.array(z.string()).min(1).max(50), action: z.enum(["SNOOZE", "HANDLE", "RESTORE"]), days: z.number().int().min(1).max(90).optional() }).parse(req.body),
    data = body.action === "HANDLE" ? { triageStatus: "HANDLED", handledAt: new Date(), snoozedUntil: null } : body.action === "RESTORE" ? { triageStatus: "INBOX", handledAt: null, snoozedUntil: null } : { triageStatus: "INBOX", handledAt: null, snoozedUntil: new Date(Date.now() + (body.days ?? 1) * 86400000) };
  const result = await db.email.updateMany({ where: { userId: user.id, id: { in: body.ids } }, data });
  return { updated: result.count };
});
app.post("/api/inbox/:id/task", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const id = (req.params as { id: string }).id,
    email = await db.email.findFirst({ where: { id, userId: user.id }, include: { analysisRecord: true } });
  if (!email) return reply.code(404).send({ error: "Email not found" });
  const existing = await db.task.findFirst({ where: { userId: user.id, emailId: id, status: { not: "ARCHIVED" } } });
  if (existing) return reply.code(409).send({ error: "A task already exists for this email" });
  const task = await db.task.create({ data: { userId: user.id, emailId: id, title: email.subject, priority: email.analysisRecord?.priority ?? "MEDIUM", source: "EMAIL", createdByAi: false } });
  reply.code(201);
  return task;
});
app.post("/api/inbox/:id/draft", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const id = (req.params as { id: string }).id,
    body = z.object({ tone: z.enum(["friendly", "formal", "direct", "concise", "detailed"]) }).parse(req.body),
    email = await db.email.findFirst({ where: { id, userId: user.id } });
  if (!email) return reply.code(404).send({ error: "Email not found" });
  const minute = new Date().toISOString().slice(0, 16).replaceAll(":", "-");
  await enqueue({ name: "email.draft", userId: user.id, emailId: id, tone: body.tone }, `draft-${id}-${body.tone}-${minute}`);
  reply.code(202);
  return { status: "queued" };
});
app.patch("/api/drafts/:id", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const id = (req.params as { id: string }).id,
    body = z.object({ body: z.string().min(1).max(20000), subject: z.string().min(1).max(500), recipients: z.array(z.string().email()).min(1).max(20) }).parse(req.body),
    draft = await db.emailDraft.findFirst({ where: { id, email: { userId: user.id } } });
  if (!draft) return reply.code(404).send({ error: "Draft not found" });
  return db.emailDraft.update({ where: { id }, data: { ...body, status: "EDITED" } });
});
app.post("/api/drafts/:id/approval", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const id = (req.params as { id: string }).id,
    draft = await db.emailDraft.findFirst({ where: { id, email: { userId: user.id } }, include: { email: true, approvals: { where: { status: "PENDING" } } } });
  if (!draft) return reply.code(404).send({ error: "Draft not found" });
  if (draft.approvals.length) return reply.code(409).send({ error: "Draft is already awaiting approval" });
  const approval = await db.approvalRequest.create({ data: { userId: user.id, draftId: id, type: "SEND_EMAIL", reason: "Send the reviewed reply from Reply Studio", riskLevel: "HIGH", payload: { kind: "SEND_EMAIL", to: draft.recipients, subject: draft.subject, body: draft.body, gmailThreadId: draft.email.gmailThreadId }, status: "PENDING" } });
  await db.emailDraft.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
  reply.code(201);
  return approval;
});
app.get("/api/inbox/:id", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  return db.email.findFirst({
    where: { id: (req.params as { id: string }).id, userId: user.id },
    include: { analysisRecord: true, drafts: { orderBy: { createdAt: "desc" } }, tasks: true },
  });
});
app.post("/api/inbox/:id/analyze", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const id = (req.params as { id: string }).id;
  const email = await db.email.findFirst({
    where: { id, userId: user.id },
    include: { analysisRecord: true },
  });
  if (!email) return reply.code(404).send({ error: "Email not found" });
  if (email.analysisRecord)
    return reply.code(409).send({ error: "Email has already been analyzed" });
  await enqueue(
    { name: "email.analyze", userId: user.id, emailId: id },
    `analyze-manual-${id}`,
  );
  reply.code(202);
  return { status: "queued" };
});
app.post("/api/inbox/sync", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  await enqueue(
    { name: "gmail.sync", userId: user.id },
    `gmail-sync-${user.id}-${new Date().toISOString().slice(0, 13)}`,
  );
  reply.code(202);
  return { status: "queued" };
});
app.get("/api/gmail/watch", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const watch = await db.gmailWatch.findUnique({ where: { userId: user.id } });
  return { configured: integrationState(env).gmailPush, active: Boolean(watch && watch.status === "ACTIVE" && watch.expiresAt > new Date()), expiresAt: watch?.expiresAt ?? null, lastNotificationAt: watch?.lastNotificationAt ?? null };
});
app.post("/api/gmail/watch", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  if (!env.GMAIL_PUBSUB_TOPIC || !integrationState(env).gmailPush)
    return reply.code(503).send({ error: "Gmail push synchronization is not configured" });
  const metadata = await startGmailWatch(await googleAuthFor(user.id), env.GMAIL_PUBSUB_TOPIC);
  const watch = await db.gmailWatch.upsert({ where: { userId: user.id }, update: { ...metadata, status: "ACTIVE" }, create: { userId: user.id, ...metadata } });
  reply.code(201);
  return watch;
});
app.post("/api/google/gmail/push", async (req, reply) => {
  if (!env.GMAIL_PUSH_AUDIENCE || !env.GMAIL_PUSH_SERVICE_ACCOUNT)
    return reply.code(503).send({ error: "Push verification is not configured" });
  const authorization = req.headers.authorization,
    token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return reply.code(401).send({ error: "Missing push identity" });
  try {
    const identity = await verifyGooglePushToken(token, env.GMAIL_PUSH_AUDIENCE);
    if (!identity?.email_verified || identity.email !== env.GMAIL_PUSH_SERVICE_ACCOUNT)
      return reply.code(403).send({ error: "Invalid push identity" });
  } catch {
    return reply.code(401).send({ error: "Invalid push identity" });
  }
  const envelope = z.object({ message: z.object({ data: z.string(), messageId: z.string().optional() }) }).parse(req.body),
    notification = z.object({ emailAddress: z.string().email(), historyId: z.string() }).parse(JSON.parse(Buffer.from(envelope.message.data, "base64").toString("utf8"))),
    user = await db.user.findUnique({ where: { email: notification.emailAddress } });
  if (!user) return reply.code(204).send();
  await db.gmailWatch.updateMany({ where: { userId: user.id }, data: { historyId: notification.historyId, lastNotificationAt: new Date(), status: "ACTIVE" } });
  await enqueue({ name: "gmail.sync", userId: user.id }, `gmail-push-${user.id}-${notification.historyId}`);
  return { status: "queued" };
});
app.get("/api/tasks", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  return db.task.findMany({
    where: { userId: user.id, status: { not: "ARCHIVED" } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
});
app.post("/api/tasks", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const body = z.object({ title: z.string().trim().min(1).max(240), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"), dueAt: z.iso.datetime().optional() }).parse(req.body);
  const task = await db.task.create({ data: { userId: user.id, title: body.title, priority: body.priority, dueAt: body.dueAt ? new Date(body.dueAt) : null, source: "USER", createdByAi: false } });
  reply.code(201);
  return task;
});
app.get("/api/follow-ups", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const now = new Date(), twoDaysAgo = new Date(now.getTime() - 2 * 86400000), oneDayAgo = new Date(now.getTime() - 86400000);
  const [tasks, emails, approvals, preferences] = await Promise.all([
    db.task.findMany({ where: { userId: user.id, status: { notIn: ["DONE", "ARCHIVED"] }, dueAt: { lt: now } }, orderBy: { dueAt: "asc" }, take: 25 }),
    db.email.findMany({ where: { userId: user.id, receivedAt: { lt: twoDaysAgo }, analysisRecord: { requiresAction: true }, drafts: { none: {} } }, include: { analysisRecord: true }, orderBy: { receivedAt: "asc" }, take: 25 }),
    db.approvalRequest.findMany({ where: { userId: user.id, status: "PENDING", requestedAt: { lt: oneDayAgo } }, include: { draft: true }, orderBy: { requestedAt: "asc" }, take: 25 }),
    db.followUpPreference.findMany({ where: { userId: user.id } }),
  ]);
  const signals = [
    ...tasks.map((task) => ({ key: `task:${task.id}`, kind: "OVERDUE_TASK", title: task.title, detail: `Due ${task.dueAt?.toISOString() ?? "earlier"}`, href: "/tasks", occurredAt: task.dueAt?.toISOString() ?? task.updatedAt.toISOString(), urgency: task.priority })),
    ...emails.map((email) => ({ key: `email:${email.id}`, kind: "AWAITING_REPLY", title: email.subject, detail: `${email.sender} · ${email.analysisRecord?.summary ?? email.preview}`, href: `/inbox/${email.id}`, occurredAt: email.receivedAt.toISOString(), urgency: email.analysisRecord?.priority ?? "MEDIUM" })),
    ...approvals.map((approval) => ({ key: `approval:${approval.id}`, kind: "STALE_APPROVAL", title: approval.draft?.subject ?? approval.type.replaceAll("_", " "), detail: approval.reason, href: `/approvals/${approval.id}`, occurredAt: approval.requestedAt.toISOString(), urgency: approval.riskLevel })),
  ];
  const preference = new Map(preferences.map((item) => [item.signalKey, item]));
  return signals.filter((signal) => { const item = preference.get(signal.key); return !item?.dismissedAt && (!item?.snoozedUntil || item.snoozedUntil <= now); });
});
app.post("/api/follow-ups/action", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const body = z.object({ signalKey: z.string().min(3).max(200), action: z.enum(["SNOOZE", "DISMISS"]), days: z.number().int().min(1).max(90).optional() }).parse(req.body);
  const data = body.action === "DISMISS" ? { dismissedAt: new Date(), snoozedUntil: null } : { dismissedAt: null, snoozedUntil: new Date(Date.now() + (body.days ?? 1) * 86400000) };
  await db.followUpPreference.upsert({ where: { userId_signalKey: { userId: user.id, signalKey: body.signalKey } }, update: data, create: { userId: user.id, signalKey: body.signalKey, ...data } });
  reply.code(204);
});
app.get("/api/calendar", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  return db.calendarEvent.findMany({
    where: { userId: user.id, endAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    take: 100,
  });
});
app.get("/api/calendar/focus", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const settings = await db.userSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } }),
    rangeStart = new Date(), rangeEnd = new Date(Date.now() + 7 * 86400000),
    events = await db.calendarEvent.findMany({ where: { userId: user.id, startAt: { lt: rangeEnd }, endAt: { gt: rangeStart } }, orderBy: { startAt: "asc" } }),
    duration = 90 * 60000, suggestions: Array<{ start: string; end: string; score: number }> = [];
  for (let day = 0; day < 7 && suggestions.length < 4; day++) {
    const start = new Date(rangeStart); start.setDate(rangeStart.getDate() + day); start.setHours(settings.workingHourStart, 0, 0, 0);
    const end = new Date(start); end.setHours(settings.workingHourEnd, 0, 0, 0);
    if ([0, 6].includes(start.getDay())) continue;
    let cursor = new Date(Math.max(start.getTime(), rangeStart.getTime()));
    for (const event of events.filter((item) => item.endAt > start && item.startAt < end)) {
      if (event.startAt.getTime() - cursor.getTime() >= duration) break;
      if (event.endAt > cursor) cursor = new Date(event.endAt.getTime() + settings.meetingBuffer * 60000);
    }
    if (end.getTime() - cursor.getTime() >= duration) suggestions.push({ start: cursor.toISOString(), end: new Date(cursor.getTime() + duration).toISOString(), score: Math.max(60, 100 - events.filter((item) => item.startAt >= start && item.startAt < end).length * 8) });
  }
  return suggestions;
});
app.post("/api/calendar/focus", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const body = z.object({ title: z.string().trim().min(1).max(120).default("Focus time"), start: z.iso.datetime(), end: z.iso.datetime(), autoDecline: z.boolean().default(false) }).refine((value) => new Date(value.end) > new Date(value.start), { message: "Focus time must end after it starts" }).parse(req.body);
  const approval = await db.approvalRequest.create({ data: { userId: user.id, type: "CREATE_FOCUS_TIME", reason: "Protect an uninterrupted deep-work block", riskLevel: "MEDIUM", payload: { kind: "CREATE_FOCUS_TIME", ...body }, status: "PENDING" } });
  reply.code(201);
  return approval;
});
app.patch("/api/tasks/:id", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const body = z
    .object({
      title: z.string().min(1).optional(),
      status: z
        .enum(["BACKLOG", "TODO", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"])
        .optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      dueAt: z.iso.datetime().nullable().optional(),
    })
    .parse(req.body);
  return db.task.update({
    where: { id: (req.params as { id: string }).id, userId: user.id },
    data: {
      ...body,
      dueAt:
        body.dueAt === undefined
          ? undefined
          : body.dueAt === null
            ? null
            : new Date(body.dueAt),
    },
  });
});
app.get("/api/approvals", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  return db.approvalRequest.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    include: { draft: true },
  });
});
app.get("/api/approvals/:id", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const approval = await db.approvalRequest.findFirst({
    where: { id: (req.params as { id: string }).id, userId: user.id },
    include: { draft: true },
  });
  if (!approval) return reply.code(404).send({ error: "Approval not found" });
  return approval;
});
app.patch("/api/approvals/:id", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const body = z
      .object({
        decision: z.enum(["APPROVE", "REJECT"]),
        draftBody: z.string().min(1).optional(),
      })
      .parse(req.body),
    id = (req.params as { id: string }).id;
  const current = await db.approvalRequest.findFirst({
    where: { id, userId: user.id, status: "PENDING" },
    include: { draft: true },
  });
  if (!current)
    return reply.code(409).send({ error: "Approval is no longer pending" });
  if (body.draftBody && current.draftId)
    await db.emailDraft.update({
      where: { id: current.draftId },
      data: { body: body.draftBody },
    });
  const status = body.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const result = await db.approvalRequest.update({
    where: { id },
    data: { status, decidedAt: new Date() },
  });
  if (status === "APPROVED")
    await enqueue(
      { name: "approval.execute", userId: user.id, approvalId: id },
      `approval-${current.executionKey}`,
    );
  return result;
});
app.post("/api/approvals/:id/retry", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const id = (req.params as { id: string }).id;
  const approval = await db.approvalRequest.findFirst({
    where: { id, userId: user.id, status: { in: ["APPROVED", "FAILED"] } },
  });
  if (!approval)
    return reply.code(409).send({ error: "Approval is not retryable" });
  if (approval.status === "FAILED")
    await db.approvalRequest.update({
      where: { id },
      data: { status: "APPROVED", error: null },
    });
  await enqueue(
    { name: "approval.execute", userId: user.id, approvalId: id },
    `approval-${approval.executionKey}-retry`,
  );
  reply.code(202);
  return { status: "queued" };
});
app.get("/api/activity", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  return db.agentRun.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { steps: true, toolCalls: true },
  });
});
app.get("/api/activity/:id", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const run = await db.agentRun.findFirst({
    where: { id: (req.params as { id: string }).id, userId: user.id },
    include: {
      steps: { orderBy: { startedAt: "asc" } },
      toolCalls: { orderBy: { timestamp: "asc" } },
      approvals: true,
    },
  });
  if (!run) return reply.code(404).send({ error: "Agent run not found" });
  return run;
});
app.get("/api/settings", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  return db.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
});
app.patch("/api/settings", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  const body = z
    .object({
      timezone: z.string().min(1).max(100),
      workingHourStart: z.number().int().min(0).max(23),
      workingHourEnd: z.number().int().min(1).max(24),
      meetingDuration: z.number().int().min(15).max(180),
      meetingBuffer: z.number().int().min(0).max(120),
      theme: z.enum(["system", "light", "dark"]),
      accent: z.enum(["violet", "ocean", "ember", "mint"]),
      motion: z.enum(["full", "reduced"]),
      density: z.enum(["comfortable", "compact"]),
      taskView: z.enum(["kanban", "sprint", "list", "matrix"]),
      autoCreateTasks: z.boolean(),
      requireSendApproval: z.boolean(),
      requireScheduleApproval: z.boolean(),
    })
    .refine((value) => value.workingHourEnd > value.workingHourStart, {
      message: "Working day must end after it starts",
    })
    .parse(req.body);
  return db.userSettings.upsert({
    where: { userId: user.id },
    update: body,
    create: { userId: user.id, ...body },
  });
});
app.get("/api/events", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  let cursor = new Date(
    (req.headers["last-event-id"] as string | undefined) ?? Date.now() - 30000,
  );
  const pump = async () => {
    const events = await db.eventRecord.findMany({
      where: { userId: user.id, createdAt: { gt: cursor } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    for (const event of events) {
      cursor = event.createdAt;
      reply.raw.write(
        `id: ${event.createdAt.toISOString()}\ndata: ${JSON.stringify({ version: 1, id: event.id, type: event.type, userId: event.userId, runId: event.runId, message: event.message, timestamp: event.createdAt.toISOString(), data: event.data })}\n\n`,
      );
    }
  };
  await pump();
  const interval = setInterval(() => {
    void pump();
    reply.raw.write(": heartbeat\n\n");
  }, 15000);
  req.raw.on("close", () => clearInterval(interval));
});
const shutdown = async () => {
  await app.close();
  await agentQueue.close();
  await connection.quit();
  await db.$disconnect();
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
await app.listen({ host: "0.0.0.0", port: 4000 });
