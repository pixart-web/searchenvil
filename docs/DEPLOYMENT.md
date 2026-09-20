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

## Docker verification (SA-RC21 findings #2 and #6)

All three production images were actually built and smoke tested in a real container — not just
inspected. Exact commands:

```bash
docker build -f apps/api/Dockerfile -t searchanvil-api:sa-rc21 .
docker build -f apps/worker/Dockerfile -t searchanvil-worker:sa-rc21 .
docker build -f apps/web/Dockerfile -t searchanvil-web:sa-rc21 --build-arg NEXT_PUBLIC_API_URL=http://localhost:4001 .
```

All three built successfully. Each was then run as a real container against the local dev
Postgres/Redis (via `host.docker.internal` and the published dev ports) and verified:

- **API**: process starts, `/health` and `/ready` both return `200` (`ready` confirms live
  Postgres + Redis connectivity), `docker stop` exits cleanly (`exitCode=0`, graceful shutdown).
- **Worker**: process starts, connects to Postgres/Redis, initializes all three queues
  (crawl/audit/performance). A genuinely new crawl was triggered against the running container via
  a local API instance; the containerized worker processed crawl → audit → performance end to end,
  including a **real Chromium launch inside the container** producing a real `PagePerformance` row
  (`status: "COMPLETED"`, real `ttfbMs`/`lcpMs`/`cls` values — not fabricated). `docker stop` exits
  cleanly.
- **Web**: process starts, `/`, `/login`, `/register` all return `200`, the SearchAnvil brand
  renders in the actual HTML response, and the build-time `NEXT_PUBLIC_API_URL` was confirmed baked
  into the served client JS bundle (not just passed as an unused build arg). `docker stop` exits
  cleanly.

**Real bugs found and fixed by actually running these builds** (not discoverable by reading the
Dockerfiles alone):

1. `pnpm add -g turbo` failed in the `pruner` stage — corepack's default global bin directory
   wasn't on `PATH`. Fixed by setting `PNPM_HOME`/`PATH` explicitly in the shared `base` stage of
   all three Dockerfiles.
2. The `installer` stage's `pnpm turbo run build` failed with TypeScript errors across every
   package that imports Prisma-generated types — `prisma generate` was never run inside the
   pruned Docker build context (it only ran as part of local dev's `pnpm db:generate`, never
   inside the image build). Fixed by adding `pnpm --filter @searchanvil/database run generate`
   before the build step in the api/worker Dockerfiles (web doesn't depend on
   `@searchanvil/database` at all, so it doesn't need this step).
3. The worker container crashed at startup with a Prisma "could not locate the Query Engine"
   binary-target mismatch — its `installer` stage ran on Alpine (musl libc) while its `runner`
   stage (the Playwright base image, needed for Chromium) is Debian-based (glibc), so the
   generated query engine binary didn't match the runtime. Fixed by building **every** stage of
   the worker image on the same Playwright base image, eliminating the libc mismatch entirely.
4. `node -e 'require("playwright-core")'` (used to resolve `CHROMIUM_EXECUTABLE_PATH` at
   container start) failed with `MODULE_NOT_FOUND` — pnpm's strict, non-hoisting `node_modules`
   layout means a package only resolves from a workspace that actually declares it as a
   dependency, and `apps/worker` only depended on `playwright-core` transitively (via
   `@searchanvil/performance`). Fixed by adding `playwright-core` as a direct dependency of
   `@searchanvil/worker`.
5. `docker stop` on the running API container timed out and fell back to `SIGKILL`
   (`exitCode=137`) instead of exiting gracefully. Root cause: `CRAWL_QUEUE`'s BullMQ `Queue`
   (with its own open ioredis connection) was a plain factory-provided value with no
   `OnModuleDestroy` hook, so `app.enableShutdownHooks()` never closed it and the event loop never
   emptied. Fixed with an explicit `SIGTERM`/`SIGINT` handler in `apps/api/src/main.ts` that
   closes the Nest app *and* the queue explicitly, then exits — verified by re-running the exact
   same container stop and confirming `exitCode=0`.
6. Both `pnpm start` (api/worker) and `next start` via `pnpm start` (web) triggered corepack's
   runtime package-manager verification as the container's non-root user, which failed with
   `EACCES` on a missing cache directory. Fixed by running the compiled entrypoint directly
   (`node dist/main.js` for api/worker, `node_modules/.bin/next start` for web) instead of going
   through `pnpm`/corepack at container runtime — package-manager indirection is now needed only
   at image *build* time, never at container *start* time.

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
