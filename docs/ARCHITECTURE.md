# Architecture

## Shape

SearchAnvil is a **modular monolith with separately scalable workers**, not a microservices
system. There is one API process, one (horizontally scalable) worker process, and one web
process, sharing a single PostgreSQL database and a single Redis instance.

```
Internet
  │
  ▼
Web (Next.js)  ──────────────►  API (NestJS, /api/v1)  ──────────────►  PostgreSQL
                                        │
                                        ▼
                                   Redis (BullMQ)
                                        │
                                        ▼
                                   Worker(s)
                                   ├─ Crawl processor
                                   ├─ Audit processor
                                   ├─ Performance processor
                                   └─ Report processor
```

Workers are horizontally scalable independently of the API — see `apps/worker`. Postgres is the
single source of truth for all business state; Redis/BullMQ is transient job coordination, never
a system of record (see [DECISIONS.md](./DECISIONS.md)).

## Why a monolith, not microservices

The product surface (crawl → facts → audit → score → present) is a single, tightly-coupled
pipeline operated by one team. Splitting it into services before there is an operational reason
to (independent scaling needs, independent deploy cadence, organizational boundaries) would add
network-call failure modes and deployment complexity without a corresponding benefit. Workers are
already split out as separately deployable/scalable processes, which is the actual scaling
pressure point (crawling and Lighthouse runs are CPU/IO heavy; the API is not).

## Crawler ≠ Audit Engine

This is an enforced architectural boundary, not just a naming convention:

```
CRAWLER  →  FACTS (CrawlPage, CrawlLink, CrawlImage, CrawlStructuredDataBlock)  →  STORAGE
                                                                                      │
                                                                                      ▼
                                                                              AUDIT ENGINE
                                                                                      │
                                                                                      ▼
                                                                                 FINDINGS
```

`@searchanvil/crawler` collects observable facts only — e.g. `title: null`. It must never contain
SEO judgment. `@searchanvil/audit-engine` consumes those facts and produces findings — e.g.
"missing title → HIGH severity indexability issue". See [CRAWLER.md](./CRAWLER.md) and
[AUDIT_ENGINE.md](./AUDIT_ENGINE.md) for the respective contracts. This separation is enforced by
package boundaries (the crawler package has no dependency on the audit-engine package or vice
versa) and is testable by fixture (docs/TESTING.md).

## Multi-tenancy

```
User → OrganizationMember → Organization → Project → Site → Crawl → ...
```

Every tenant-scoped resource is reached only through its Organization, and every API route that
returns or mutates tenant data re-derives the caller's membership/role server-side — the frontend
never gets to decide what a user can see. See [SECURITY.md](./SECURITY.md) and
[DATABASE.md](./DATABASE.md).

## Technology baseline

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | No `any` as an escape hatch |
| Package manager | pnpm workspaces | `pnpm-workspace.yaml` |
| Build orchestration | Turborepo | `turbo.json` |
| Web | Next.js (App Router) + React | `apps/web` |
| API | NestJS | `apps/api`, versioned at `/api/v1` |
| ORM | Prisma | `packages/database` |
| Database | PostgreSQL 16 | `docker-compose.yml` for local dev |
| Cache/Queue transport | Redis 7 | `docker-compose.yml` for local dev |
| Job queue | BullMQ | `packages/queue`, `apps/worker` |
| HTML fetching | undici | `packages/crawler` |
| HTML parsing | cheerio | `packages/crawler` |
| Browser rendering (fallback only) | Playwright | introduced only where static fetch is insufficient |
| Performance auditing | Lighthouse (or current equivalent) | sampled, bounded — see docs/PERFORMANCE notes in Phase 12 progress doc |
| Styling | Tailwind CSS | `apps/web/tailwind.config.ts` |
| UI primitives | shadcn/ui (infrastructure only) | SearchAnvil components in `packages/ui` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |
| Containers | Docker / docker-compose | dev only until Phase 20 |

Exact installed versions are pinned in each package's `package.json`; the lockfile
(`pnpm-lock.yaml`) is the source of truth for resolved versions.

## Request lifecycle (API)

1. `RequestIdMiddleware` stamps every request with `x-request-id` (generates one if absent).
2. `ThrottlerGuard` applies a global rate limit (per-route overrides added as needed).
3. Controllers validate input via `class-validator` DTOs (`ValidationPipe` with
   `whitelist`/`forbidNonWhitelisted`).
4. `GlobalExceptionFilter` normalizes every error to `{ error: { code, message, requestId,
   details? } }` and never leaks stack traces to the client (see [SECURITY.md](./SECURITY.md)).
5. Nest's shutdown hooks are enabled so SIGTERM drains in-flight requests before the process
   exits.

## Job lifecycle (Worker)

Jobs are enqueued by the API (never processed inline in a request) and picked up by
`apps/worker`. Job payloads are intentionally thin (IDs only — see `packages/queue`); the worker
re-reads current state from Postgres rather than trusting stale job payload data. This keeps jobs
idempotent-friendly and avoids Redis becoming a second source of truth.
