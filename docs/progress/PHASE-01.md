# Phase 01 — Foundation

**Status: COMPLETE — gate passed.**

## Scope implemented

- pnpm + Turborepo monorepo: `apps/{web,api,worker}`, `packages/{shared,database,queue,crawler,
  audit-engine,ui,eslint-config,tsconfig}`.
- Shared TypeScript configs (`packages/tsconfig`) and ESLint configs (`packages/eslint-config`,
  base/next/nest variants) used by every workspace member.
- PostgreSQL schema (`packages/database/prisma/schema.prisma`) covering identity/multi-tenancy
  (User, Session, PasswordResetToken, Organization, OrganizationMember) and the full product loop
  (Project, Site, Crawl, CrawlPage, CrawlLink, CrawlImage, CrawlStructuredDataBlock, AuditRule,
  AuditRun, AuditIssue, AuditOccurrence, AuditScore, Report, UsageRecord). First migration
  (`20260919175610_init`) generated and applied.
- `@searchanvil/database`: Prisma client singleton (`prisma`), seed script creating a demo
  org/user/project/site.
- `@searchanvil/queue`: typed BullMQ queue names/job payloads (`CRAWL`, `AUDIT`, `PERFORMANCE`,
  `REPORT`), shared Redis connection, `createTypedQueue`/`createTypedWorker` factories, sane
  default job options (retries, backoff, cleanup).
- `@searchanvil/shared`: role/permission model (`OrganizationRole`, `can()`), URL normalization
  (`normalizeUrl`, `isSameOrigin`, `isValidHttpUrl`) that the crawler will build on in Phase 05,
  common API/pagination types.
- `apps/api` (NestJS): global validation pipe, helmet, CORS, request-id middleware, global
  exception filter normalizing all errors to `{ error: { code, message, requestId, details? } }`,
  throttler guard, `/health` and `/ready` (checks Postgres + Redis live), graceful shutdown hooks,
  versioned prefix `/api/v1` (health/ready excluded).
- `apps/worker`: BullMQ worker skeleton consuming the `crawl` queue, structured JSON logging,
  graceful shutdown on SIGTERM/SIGINT. Processor is a placeholder (proves connectivity); replaced
  by the real crawl pipeline in Phase 05/06.
- `apps/web` (Next.js 15 / React 19): app shell, Tailwind configured with the SearchAnvil token
  set from the brand spec (forge/steel/ember/violet/success/warning/danger), dark-first
  `<html class="dark">`, placeholder landing page.
- `docker-compose.yml`: Postgres 16 + Redis 7 for local dev (non-default host ports 5433/6380 —
  see ADR-003 — to avoid colliding with another project already running on this machine).
- `.github/workflows/ci.yml`: install → prisma generate → migrate deploy → lint → typecheck →
  test → build, against real Postgres/Redis service containers.
- `docs/`: README, ARCHITECTURE, PRODUCT, DEVELOPMENT, DECISIONS (4 ADRs), BACKLOG, and this
  progress record. Remaining doc files (DATABASE, CRAWLER, AUDIT_ENGINE, SCORING, API, SECURITY,
  TESTING, DESIGN_SYSTEM, DEPLOYMENT, OPERATIONS, RELEASE_CHECKLIST) are written as their
  corresponding phases land, per the build plan.

## Key files

- `pnpm-workspace.yaml`, `turbo.json`, root `package.json`
- `packages/database/prisma/schema.prisma`
- `apps/api/src/app.module.ts`, `apps/api/src/health/health.controller.ts`
- `apps/worker/src/main.ts`
- `packages/queue/src/{queues,factory,connection}.ts`

## Migrations

- `packages/database/prisma/migrations/20260919175610_init` — initial schema. No destructive
  concerns (fresh database).

## Tests added

- `packages/shared/src/url.spec.ts` (13 cases) — URL normalization behavior the crawler will rely
  on for deduplication (host casing, fragments, default ports, trailing slash, query param
  ordering, relative resolution).
- `packages/shared/src/roles.spec.ts` (5 cases) — RBAC rank comparison and permission checks.
- `apps/api/src/health/health.controller.spec.ts` — `/health` unit test.
- Packages with no implementation yet (`crawler`, `audit-engine`, `ui`, `database`, `queue`,
  `worker`, `web`) run `vitest run --passWithNoTests` so CI is honest about "no tests yet" rather
  than silently green; each gets real tests in the phase that implements it.

## Commands executed and results

```
pnpm install        → 897 packages resolved, installed cleanly
docker-compose up -d → searchanvil-postgres, searchanvil-redis healthy
pnpm db:generate     → Prisma Client generated
prisma migrate dev --name init → applied 20260919175610_init
pnpm build           → 9/9 tasks succeeded (all apps + packages)
pnpm typecheck       → 15/15 tasks succeeded, 0 errors
pnpm lint            → 15/15 tasks succeeded, 0 errors/warnings
pnpm test            → 15/15 tasks succeeded (18 shared tests + 1 api test passing; rest pass-with-no-tests)
```

## Manual infra-communication proof (Phase 01 gate)

```
curl http://localhost:4000/health → {"status":"ok"}
curl http://localhost:4000/ready  → {"status":"ok","checks":{"database":"ok","redis":"ok"}}

Enqueued a real BullMQ job onto the `crawl` queue; worker log:
  "processing crawl job" jobId=1 crawlId=00000000-0000-0000-0000-000000000099
  "crawl job completed" jobId=1
```

This confirms API→Postgres, API→Redis, and Worker→Redis→Postgres all communicate correctly
end-to-end, not just that the code compiles.

## Architecture decisions

Recorded in `docs/DECISIONS.md`: ADR-001 (modular monolith), ADR-002 (pnpm+Turborepo),
ADR-003 (local dev ports), ADR-004 (queue job payloads carry IDs only).

## Bugs found during self-audit and fixes made

- `packages/shared/src/url.ts` failed to compile: `URL`/`URLSearchParams` require either the DOM
  lib or `@types/node`; DOM lib caused a separate type conflict (`URLSearchParams.keys()`
  mismatch between the DOM and Node type definitions). Fixed by adding `@types/node` as a
  devDependency to every library package instead of widening `lib` — keeps Node-only packages on
  Node's own global types.
- `apps/api`: `express-serve-static-core` module augmentation failed to resolve under the
  project's module resolution; switched the augmentation target to `express` directly and added
  `express` + matching `@types/express@^4` (the API runs on Express 4 via
  `@nestjs/platform-express`) as explicit dependencies rather than relying on transitive
  resolution.
- `apps/api`: `ioredis` was used directly in `health.controller.ts` but only available
  transitively via `@searchanvil/queue`; added as a direct dependency (workspace packages should
  not rely on another package's transitive deps being hoisted).
- Every library package except `apps/web` was missing an `.eslintrc.json`, causing ESLint to fail
  with "couldn't find a configuration file" the moment more than one package had lint-able code.
  Added a consistent `.eslintrc.json` per package extending `@searchanvil/eslint-config`.
- Packages without implementation yet failed `vitest run` with exit code 1 on "no test files
  found" (the correct behavior, but not what we want blocking CI before those phases start).
  Changed their `test` script to `vitest run --passWithNoTests`; packages with real logic
  (`shared`, `api`) keep the strict `vitest run` so a regression there still fails CI.
- Initial `docker-compose.yml` used the Postgres/Redis default ports, which collided with an
  unrelated project's containers already running on this machine. Moved to 5433/6380 and
  documented why (ADR-003) so this doesn't look like an accident to a future reader.

## Known limitations / technical debt

- `apps/worker`'s crawl processor is a connectivity placeholder, not the real pipeline (by
  design — Phase 05/06).
- No authentication yet (Phase 03) — the API has no protected routes yet, so this is expected,
  not a gap against this phase's gate.
- Prisma's `package.json#prisma` config key is deprecated in favor of `prisma.config.ts`; left
  as-is since it still works on the installed Prisma 6.19 and migrating is a mechanical,
  low-risk cleanup better batched into a later phase than done piecemeal now.
- CI workflow has not yet been run on actual GitHub Actions infrastructure (no remote configured
  for this repo yet) — it mirrors the exact command sequence verified locally against real
  Postgres/Redis containers, but "runs green on GitHub" itself is unverified until the repo has a
  remote.

## Security considerations

- Structured error responses never include stack traces to the client (`GlobalExceptionFilter`).
- `helmet()` applied globally; CORS restricted to `WEB_URL`, credentialed.
- No secrets committed — `.env` is gitignored, `.env.example` has placeholder values only.
- Global throttling in place as a baseline; per-route tightening (e.g. auth endpoints) lands in
  Phase 03.

## Readiness for next phase

Gate met: the repository builds, lints, typechecks, and tests cleanly, and the API/worker
demonstrably communicate with Postgres and Redis. Proceeding to Phase 02 (Design System &
Application Shell).
