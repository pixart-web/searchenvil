# Architecture Decision Records

Lightweight ADRs. Newest first.

## ADR-006: Turborepo tasks declare their own env var dependencies explicitly

**Status:** Accepted (Phase 03)

**Context:** Turbo 2.x filters which environment variables a task's child process sees based on
declared inputs. `pnpm build` at the repo root was intermittently failing `apps/web`'s `next
build` with an obscure prerendering error (`<Html> should not be imported outside of
pages/_document`) — the actual cause was `NODE_ENV=development` from a locally sourced `.env`
leaking into the build process and causing a React dev/prod module mismatch, only reproducible
when running through Turbo (a direct `pnpm --filter @searchenvil/web run build` was unaffected).

**Decision:** `apps/web`'s `build` script pins `NODE_ENV=production next build` explicitly rather
than trusting the ambient shell environment. `turbo.json`'s `test`/`test:e2e` tasks declare
exactly the env vars they need (`DATABASE_URL`, `REDIS_URL`, session config) instead of using a
blanket `envMode: "loose"`, so each task's environment is explicit and reviewable rather than
"whatever the invoking shell happened to have."

**Consequences:** Root-level `pnpm build`/`pnpm test`/`pnpm test:e2e` now behave identically
regardless of what's in the developer's shell environment — verified by reproducing the failure,
fixing it, and rerunning the full pipeline clean multiple times in a row.

## ADR-005: Session cookies (server-revocable), not JWTs

**Status:** Accepted (Phase 03)

**Context:** Needed to choose an authentication token strategy for the API.

**Decision:** Opaque random session tokens, stored server-side as a SHA-256 hash
(`Session.tokenHash`) with an expiry, delivered via an `httpOnly` cookie. CSRF is handled via a
double-submit cookie (`searchenvil_csrf`, non-httpOnly, echoed in an `x-csrf-token` header on
mutating requests). See `docs/SECURITY.md`.

**Consequences:** Every request that needs the current user costs a DB lookup (acceptable at this
scale; can add a short-lived cache later if it becomes a bottleneck). In exchange, logout and
password-reset can truly invalidate a session immediately — a JWT would need a revocation list to
get the same guarantee, which is more moving parts for no benefit at this stage.

## ADR-004: Redis/BullMQ job payloads carry IDs only, never full state

**Status:** Accepted (Phase 01)

**Context:** Job payloads could either carry a full snapshot of the work to do, or just enough
identifiers for the worker to re-read current state from Postgres.

**Decision:** `packages/queue` job types (`CrawlJobData`, `AuditJobData`, etc.) carry IDs only.
The worker treats Postgres as the sole source of truth and Redis as transient coordination (see
section 24/`docs/ARCHITECTURE.md`).

**Consequences:** Slightly more DB reads per job, but jobs stay idempotent-friendly, a
Redis flush never loses business state, and a job's behavior always reflects current data even if
it sat in the queue for a while.

## ADR-003: Local dev Postgres/Redis run on non-default ports

**Status:** Accepted (Phase 01)

**Context:** The dev machine used for initial build-out already runs another project's Postgres
(5432) and Redis (6379) containers.

**Decision:** `docker-compose.yml` exposes Postgres on `5433` and Redis on `6380`; `.env.example`
matches. This is a local-dev-only convenience — production deployment (Phase 20) uses whatever
ports/hosts the target environment provides, configured via environment variables, not hardcoded
ports.

**Consequences:** Anyone following `docs/DEVELOPMENT.md` gets a working setup without port
collisions. No effect on production readiness.

## ADR-002: Monorepo via pnpm workspaces + Turborepo, not Nx or Lerna

**Status:** Accepted (Phase 01)

**Context:** Needed build orchestration and caching across `apps/*` and `packages/*` with
TypeScript project references implicitly handled through package boundaries.

**Decision:** pnpm workspaces for dependency management, Turborepo for task orchestration/caching.

**Consequences:** Lighter configuration surface than Nx for a project of this size; loses Nx's
generators/plugins ecosystem, which isn't needed here.

## ADR-001: Modular monolith, not microservices

**Status:** Accepted (Phase 01)

**Context:** Section 4/34 of the build spec mandates a modular monolith with separately scalable
workers, explicitly forbidding premature microservices.

**Decision:** One API process (NestJS), one worker process type (BullMQ, horizontally scalable),
one web process (Next.js), one Postgres, one Redis. See `docs/ARCHITECTURE.md`.

**Consequences:** Simpler operational surface for the current team size and feature set. Revisit
only if a genuine independent-scaling or independent-deploy need emerges.
