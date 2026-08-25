import { z } from "zod";
const optionalUrl = z.string().url().optional().or(z.literal(""));
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  LLM_PROVIDER: z.literal("gemini").default("gemini"),
  WEB_URL: z.string().url(),
  API_URL: z.string().url(),
  SENTRY_DSN: optionalUrl,
});
export type Env = z.infer<typeof envSchema>;
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env =>
  envSchema.parse(source);
export const integrationState = (env: Env) => ({
  google: Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.TOKEN_ENCRYPTION_KEY,
  ),
  gemini: Boolean(env.GEMINI_API_KEY),
});
