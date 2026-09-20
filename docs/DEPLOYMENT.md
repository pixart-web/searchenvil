# Deployment (prepare, not execute)

**This build has never been deployed.** No production infrastructure has been provisioned, no
production DNS or TLS configured, no production database migrated, no production secrets issued,
and no `docker build`/`docker push`/deploy command has been executed against a real target from
this repository. This document describes how a release candidate *would* be deployed — it is
deployment-artifact preparation, per the master build constraints, not a deployment log.

## What exists today

- **`apps/api/Dockerfile`**, **`apps/worker/Dockerfile`**, **`apps/web/Dockerfile`** — multi-stage
  images using `turbo prune --docker` to build a minimal, workspace-aware image per service.
  Buildable locally (`docker build -f apps/api/Dockerfile .` from the repo root) but never built
  or pushed to a registry as part of this build.
- **`docker-compose.yml`** — Postgres + Redis only, for local development (`docs/DEVELOPMENT.md`).
  Not a production compose file; it has no `api`/`worker`/`web` services and exposes dev-only
  ports/credentials.

## Required environment variables

See `.env.example` for the full, current list with inline documentation. At minimum, a real
deployment needs:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | A real, managed PostgreSQL connection string — not the dev docker-compose instance |
| `REDIS_URL` | A real, managed Redis instance shared by the API and every worker replica |
| `WEB_URL` | The real frontend origin — CORS is a single explicit origin (`docs/SECURITY.md`) |
| `NEXT_PUBLIC_API_URL` | Baked into the web build at **image build time** (see `apps/web/Dockerfile`'s `ARG`), not just container run time |
| `CHROMIUM_EXECUTABLE_PATH` | Optional — omit to run without performance sampling; see `docs/PERFORMANCE.md` for what provisioning Chromium into the worker image/sidecar would require |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Optional — omit `SMTP_HOST` to run with the console mail transport (no real password-reset emails sent); see `docs/OPERATIONS.md` |

## Database migrations

`pnpm --filter @searchanvil/database exec prisma migrate deploy` applies committed migrations
(`packages/database/prisma/migrations/`) without generating new ones — the correct command for a
non-interactive production apply, as opposed to `migrate dev` (local-only, prompts, can reset
data). This has been run locally throughout the build against the dev database; it has never been
run against a production database.

## Suggested topology

- **API**: stateless, horizontally scalable behind a load balancer; only talks to Postgres and
  Redis.
- **Worker**: stateless, horizontally scalable; BullMQ concurrency is configured per-queue
  (`WORKER_CONCURRENCY`, `PERFORMANCE_WORKER_CONCURRENCY`) so crawl/audit throughput scales
  independently of the deliberately-bounded performance-sampling throughput (`docs/PERFORMANCE.md`).
- **Web**: stateless Next.js server, horizontally scalable.
- All three read the same `DATABASE_URL`/`REDIS_URL`; only the worker needs
  `CHROMIUM_EXECUTABLE_PATH` if performance sampling is wanted.

## What is explicitly out of scope for this build

Per the master build constraints: no SSH to any host, no production DNS/TLS configuration, no
running `migrate deploy` against a real database, no issuing or storing real production secrets,
and no executing a deploy. Everything above is preparation for whoever performs the actual
deployment — a human with the authority and credentials to do so — not something this build
executed itself.
