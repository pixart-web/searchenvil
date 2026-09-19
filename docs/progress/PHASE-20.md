# Phase 20 — Release Candidate Preparation

**Status: COMPLETE — gate passed.**

## Scope implemented

Prepared deployment artifacts and closed documentation gaps — **nothing here was executed against
a real target**: no image was pushed to a registry, no migration was run against a production
database, no DNS/TLS was touched, no secret was issued. See `docs/DEPLOYMENT.md`'s own explicit
statement of this.

- **Dockerfiles**: `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile` — each a
  multi-stage build using `turbo prune --docker` to produce a minimal, workspace-aware image per
  service, plus a root `.dockerignore`. Previously none existed at all, despite `docker-compose.yml`
  and `docs/README.md` implying deployment material was in place.
- **Missing docs closed**: `docs/README.md` has linked to `docs/DATABASE.md`, `docs/DEPLOYMENT.md`,
  and `docs/OPERATIONS.md` since Phase 01, but none of the three files existed until this phase —
  a real, previously-undetected documentation gap. All three now exist:
  - `docs/DATABASE.md` — model-group orientation map plus the migration workflow.
  - `docs/DEPLOYMENT.md` — required env vars, migration command, suggested topology, and an
    explicit statement of what was never executed.
  - `docs/OPERATIONS.md` — health checks, scaling knobs, logging, `AUTH_SECRET` rotation impact,
    known operational limits, and how to trace an incident via `requestId`.
- **`.env.example` gap fixed**: `PERFORMANCE_WORKER_CONCURRENCY` and `CHROMIUM_EXECUTABLE_PATH`
  (both read by `apps/worker/src/main.ts` since Phase 12) were never added to `.env.example` — a
  real deployment following the env template alone would have silently gotten no performance
  sampling with no documented way to enable it. Added, with inline docs; `.env` (the local
  dev-only placeholder file, verified in Phase 17 to contain no real secret) brought back in sync.
- **Removed dead schema**: `Report` and `UsageRecord` — two Prisma models scaffolded early in the
  build, never referenced by any application code (Phase 14's real Reports feature computes
  everything live instead of persisting a row; usage tracking/billing is explicitly out of scope
  for this release). Found via a schema/usage cross-check while writing `docs/DATABASE.md` and
  removed via a real migration (`remove_unused_report_and_usage_record_tables`), rather than left
  as unexplained dead weight that a future reader might mistake for an unfinished feature.

## Key files

- `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore` (new)
- `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md` (new)
- `.env.example`, `.env` (added `PERFORMANCE_WORKER_CONCURRENCY`/`CHROMIUM_EXECUTABLE_PATH`)
- `packages/database/prisma/schema.prisma` (removed `Report`/`UsageRecord`) +
  migration `20260919220921_remove_unused_report_and_usage_record_tables`

## Tests added

None — this phase is documentation, deployment artifacts, and a schema cleanup with zero
application-code behavior change. The full existing suite (68 e2e tests) re-verifies the schema
change didn't break anything that actually depended on the removed models (nothing did — no code
referenced them, which is exactly why they were safe to remove).

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10. `pnpm test`: 17/17. `pnpm test:e2e`: 11/11, 68 e2e tests (unchanged count —
no behavior changed, only unused schema removed). The migration itself was applied and verified
against the local dev database (`prisma migrate dev`), the same database every other phase's live
verification has used throughout this build — never a production database.

## Architecture decisions

**Dockerfiles use `turbo prune`, not a naive `COPY . .` + full monorepo install.** A monorepo
image built without pruning would install every workspace's dependencies into every service's
image, bloating build time and image size for no benefit — `apps/web`'s image has no reason to
carry `packages/crawler`'s Playwright-adjacent dependencies, for instance. `turbo prune
<package> --docker` produces exactly the subset a given app actually needs.

**`NEXT_PUBLIC_API_URL` is a build-time `ARG`, not just a runtime `ENV`, in the web Dockerfile.**
Next.js inlines `NEXT_PUBLIC_*` variables into the client JS bundle at build time — setting it only
as a container runtime environment variable would silently have no effect on the already-built
bundle. Documented explicitly in the Dockerfile's own comment so this doesn't become a confusing
"I set the env var and it didn't work" deployment surprise later.

**Dead schema removed rather than left with an explanatory comment.** `Report`/`UsageRecord` had
zero application code referencing them — leaving them in place with a "not used yet" comment would
be indistinguishable, to a future reader, from an actually-planned-but-unbuilt feature. Removing
them and explaining *why* in `docs/DATABASE.md` is the more honest state for a release candidate:
the schema now matches what the product actually does.

## Bugs found during self-audit and fixes made

- Three missing documentation files that `docs/README.md` had linked to since Phase 01 — closed.
- Two missing `.env.example` variables for an already-shipped feature (Phase 12's performance
  sampling) — closed.
- Two entirely unused database tables, discovered while writing the database documentation this
  phase required — removed via a real, tested migration.
- No Dockerfiles existed at all despite the project being described throughout as
  container-deployable — closed.

## Known limitations / technical debt

- The Dockerfiles have been written to match the project's actual build/start scripts and
  `turbo prune` conventions, but have not themselves been built (`docker build`) as part of this
  work, per the "never deploy, never execute deployment tooling" constraint — a first real build
  attempt by whoever deploys this may surface a minor Dockerfile issue (a missing system
  dependency for a native module, for instance) that only a real build run would catch. Flagged
  honestly here rather than claimed as verified.
- No CI/CD pipeline configuration (GitHub Actions, etc.) was written — out of scope for this
  phase, which is about deployment *artifacts* for the application itself, not the pipeline that
  would build and ship them.

## Security considerations

No new attack surface — Dockerfiles run as a non-root user (`searchenvil`, uid/gid 1001) in every
image, and `.dockerignore` excludes `.env`/`.git`/`node_modules` from the build context so no
local secrets or history can accidentally end up baked into an image layer.

## Readiness for next phase

Gate met: real deployment artifacts exist (Dockerfiles, `.dockerignore`, complete environment
documentation, migration/topology guidance) without anything having been deployed, and a genuine
documentation/schema gap (three missing docs, two missing env vars, two dead tables) was found and
closed rather than assumed fine. Proceeding to the Final Codex Audit and `docs/FINAL_HANDOFF.md`.
