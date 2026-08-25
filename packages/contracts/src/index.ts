import { z } from "zod";

export const PrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const EmailCategorySchema = z.enum([
  "IMPORTANT",
  "RECRUITING",
  "MEETING",
  "PROJECT",
  "FOLLOW_UP",
  "FINANCE",
  "NEWSLETTER",
  "PERSONAL",
  "OTHER",
]);
export const EmailAnalysisSchema = z.object({
  summary: z.string().min(1),
  category: EmailCategorySchema,
  priority: PrioritySchema,
  requiresAction: z.boolean(),
  schedulingIntent: z.boolean(),
  actionItems: z.array(
    z.object({ title: z.string().min(1), priority: PrioritySchema }),
  ),
  suggestedReply: z.string().optional(),
});
export type EmailAnalysis = z.infer<typeof EmailAnalysisSchema>;
export const DraftReplySchema = z.object({ body: z.string().min(1).max(10000) });
export type DraftReply = z.infer<typeof DraftReplySchema>;
export const ApprovalPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SEND_EMAIL"),
    to: z.array(z.string().email()).min(1),
    subject: z.string(),
    body: z.string().min(1),
    gmailThreadId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("CREATE_EVENT"),
    title: z.string().min(1),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    attendees: z.array(z.string().email()).default([]),
  }),
  z.object({
    kind: z.literal("CREATE_FOCUS_TIME"),
    title: z.string().min(1),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    autoDecline: z.boolean().default(false),
  }),
]);
export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;
export const QueueJobSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("gmail.sync"), userId: z.string() }),
  z.object({
    name: z.literal("email.analyze"),
    userId: z.string(),
    emailId: z.string(),
  }),
  z.object({
    name: z.literal("email.draft"),
    userId: z.string(),
    emailId: z.string(),
    tone: z.enum(["friendly", "formal", "direct", "concise", "detailed"]),
  }),
  z.object({
    name: z.literal("approval.execute"),
    userId: z.string(),
    approvalId: z.string(),
  }),
]);
export type QueueJob = z.infer<typeof QueueJobSchema>;
export const SseEventSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  type: z.enum([
    "agent.run.started",
    "agent.step.completed",
    "agent.tool.completed",
    "approval.created",
    "approval.updated",
    "task.created",
    "email.analyzed",
    "agent.run.completed",
    "agent.run.failed",
  ]),
  userId: z.string(),
  runId: z.string().optional(),
  message: z.string(),
  timestamp: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type SseEvent = z.infer<typeof SseEventSchema>;
