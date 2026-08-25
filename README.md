# Morrow

Morrow is a private-by-design workday assistant for Gmail, Google Calendar, tasks, and human-approved external actions. It uses a separate API and worker so an HTTP request can never directly send an email or create a meeting.

## Architecture

```text
Browser → Next.js → Fastify → PostgreSQL
                         ├→ Redis / BullMQ → Worker → Gemini
                         └──────────────────→ Gmail / Calendar
```

The monorepo contains `apps/web`, `apps/api`, and `apps/worker`. Shared packages own runtime configuration, Prisma, queue payloads, Google integration, Gemini abstraction, and Zod contracts.

## Local setup

1. Install Node.js 24 and enable Corepack.
2. Copy `.env.example` to `.env` and replace the secrets.
3. Run `docker compose up -d` for PostgreSQL and Redis.
4. Run `pnpm install`, `pnpm db:generate`, and `pnpm db:migrate --name init`.
5. Optionally run `pnpm db:seed`; seed data is development-only and never substitutes for Google APIs.
6. Run `pnpm dev`.

Docker Desktop must be running before `pnpm infra:up`. Confirm both dependencies with `pnpm infra:status`; OAuth requires PostgreSQL and background work requires Redis.

The web app runs at `http://localhost:3000`, the API at `http://localhost:4000`, and browser `/api/*` calls are proxied through Next.js for same-origin sessions and SSE.

## Google and Gemini

Create a Google Cloud OAuth web client, enable Gmail API and Google Calendar API, and register `http://localhost:3000/api/auth/callback/google`. Morrow requests read/compose/send Gmail scopes and read/write Calendar scopes. Add the client values and a base64-encoded 32-byte `TOKEN_ENCRYPTION_KEY` to `.env`.

Create a Gemini API key and set `GEMINI_API_KEY`. The provider boundary is `LLMProvider`; the initial provider uses `gemini-3.7-flash` with schema-validated JSON. Email text is treated as untrusted input and private chain-of-thought is never requested, stored, or displayed.

## Approval and security model

Safe analysis and task creation can occur in the worker. Sending email and creating events always produce a pending `ApprovalRequest`. The API can only approve or reject and enqueue an idempotent execution job. The worker revalidates ownership, status, and the typed payload before calling Google. Activity records contain safe operational summaries rather than hidden model reasoning or large provider payloads.

Tokens, OAuth secrets, and Gemini keys are server-only. Email HTML is not rendered; the vertical slice stores and displays safe text metadata. Store timestamps in UTC and use each user's configured timezone for scheduling.

## Operations

- `GET /health` reports process liveness.
- `GET /ready` checks PostgreSQL and Redis without exposing connection details.
- API and worker close HTTP, Prisma, BullMQ, and Redis connections on `SIGTERM`/`SIGINT`.
- Dockerfiles create independent web, API, and worker images.
- GitHub Actions performs lint, type-check, build, image publication, and Azure Container Apps updates. It intentionally has no automated test stage.

Recommended Azure services are Container Apps, Azure Database for PostgreSQL Flexible Server, Azure Container Registry, Key Vault, and a managed Redis-compatible service.

## Known limitations

The initial slice focuses on the meeting-request approval workflow. Credentials are required for live verification. Rich recurring sync, advanced search, expanded daily briefs, and managed Azure infrastructure provisioning are follow-up milestones. Prisma 7 is deliberately used until Prisma 8 reaches general availability.
