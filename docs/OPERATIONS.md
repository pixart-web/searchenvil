# Operations

Day-2 operational notes for a deployed instance. See `docs/DEPLOYMENT.md` for how a release would
be deployed (never executed against a real target as part of this build).

## Health checks

- `GET /health` — liveness, always `{"status":"ok"}` if the API process is up. Use for a basic
  "is it running" check.
- `GET /ready` — readiness, checks Postgres and Redis connectivity, returns `503` if either is
  down. Use this for load-balancer/orchestrator readiness probes, not `/health`, since a process
  that's up but can't reach its dependencies shouldn't receive traffic.

## Scaling knobs

- `WORKER_CONCURRENCY` (default 5) — crawl/audit job concurrency per worker replica.
- `PERFORMANCE_WORKER_CONCURRENCY` (default 1) — deliberately low; see `docs/PERFORMANCE.md` for
  why performance sampling is bounded independently of crawl/audit throughput.
- The API and web are both stateless — scale replica count directly with load; no sticky sessions
  needed (session state lives in Postgres, not in-process).

## Logs

`apps/api`, `apps/worker` both emit structured JSON logs (`{"ts","level","service","message",...}`)
to stdout — pipe to whatever log aggregation the deployment target provides. No log file rotation
is configured; console/stdout logging is the intended production pattern, letting the platform
(container runtime, orchestrator) own persistence and rotation rather than the app.

## Backups

Not configured by this build — a managed Postgres provider's automated backup/point-in-time-
recovery feature is the intended approach, not a custom backup script; nothing here assumes or
implements one.

## Rotating `AUTH_SECRET`

Rotating `AUTH_SECRET` invalidates every existing session (session tokens are hashed and verified
using it) — every signed-in user is signed out. Not currently automated; plan a maintenance
window or accept the mass-logout if rotating.

## Known operational limits (see relevant docs for detail)

- **Primary-site scope**: every project-level view (Overview, Issues, Pages, Performance, Audits,
  Reports) shows the project's first-created site only, not a multi-site aggregate — see
  `docs/progress/PHASE-09.md`'s known-limitation note. Not a bug; a deliberate scope decision for
  this release.
- **Crawl size ceiling**: `maxPages` is capped at 1000 per crawl (`docs/API.md`) — a genuinely
  larger site needs multiple crawls/sites, not a single unbounded one.
- **Performance sampling is intentionally bounded**: at most 5 pages sampled per crawl, low
  worker concurrency — see `docs/PERFORMANCE.md`.

## Incident response

`GlobalExceptionFilter` attaches a `requestId` to every error response
(`{"error":{"code","message","requestId"}}`) — ask a reporting user for it, then grep worker/API
logs for that id to find the exact request and its stack trace server-side (never exposed to the
client — see `docs/SECURITY.md`).
