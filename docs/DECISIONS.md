# Architecture Decision Records

Lightweight ADRs. Newest first.

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
