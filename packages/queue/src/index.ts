import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import type { QueueJob } from "@chief/contracts";
export const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});
let lastRedisWarning = 0;
connection.on("error", (error) => {
  const now = Date.now();
  if (now - lastRedisWarning > 30000) {
    lastRedisWarning = now;
    console.error(
      `[Chief infrastructure] Redis unavailable at ${process.env.REDIS_URL}: ${error.message}`,
    );
  }
});
export const agentQueue = new Queue<QueueJob>("chief-agent", {
  connection,
  defaultJobOptions: {
    attempts: 6,
    backoff: { type: "exponential", delay: 15000 },
    removeOnComplete: 500,
    removeOnFail: true,
  },
});
export const enqueue = (job: QueueJob, id: string, options?: JobsOptions) =>
  agentQueue.add(job.name, job, { ...options, jobId: id });
