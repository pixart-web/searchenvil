# Testing

## Strategy

Following section 30 of the build spec: meaningful tests over 100% coverage, prioritizing
critical logic. Four layers, all wired into `pnpm test` / `pnpm test:e2e` at the root:

| Layer | Where | What |
|---|---|---|
| Unit | `**/*.spec.ts` next to the code | Pure logic: URL normalization, RBAC, SSRF address blocking, robots.txt/sitemap parsing, fact extraction, password hashing, crawl concurrency |
| Integration | `apps/worker/src/**/*.spec.ts` | Real Postgres: crawl persistence, status transitions, cancellation, link resolution |
| API/E2E | `apps/api/test/*.e2e-spec.ts` | Real HTTP requests against a real Nest app + real Postgres + real Redis: auth, tenant isolation, resource CRUD |
| Manual/live | recorded in `docs/progress/PHASE-XX.md` | Full-stack proof — real browser or real curl session against the real API/worker/DB, for gates that specifically require "works end to end," not just "the pieces pass in isolation" |

E2E tests do **not** mock the database (see ADR-005/006 context) — they hit the real dev Postgres
and Redis via `DATABASE_URL`/`REDIS_URL`, matching what CI's service containers provide.

## No dependency on real/public websites

Per section 31, crawler tests never fetch a real website. `packages/crawler/src/fixtures/
fixture-server.ts` spins up a local, in-process HTTP server per test with deterministic routes —
see `crawler.spec.ts` for the multi-page fixture site (internal links, a robots-disallowed page,
a redirect, a 404) that proves the Phase 05 gate. DNS-resolution tests
(`ssrf.spec.ts`'s `createSafeLookup` tests) inject a fake resolver rather than depending on real
DNS, for the same reason.

The one deliberate exception: `docs/progress/PHASE-06.md` records a manual, real crawl of
`https://example.com` as end-to-end proof that the full API→queue→worker→crawler→Postgres
pipeline works against the actual internet, not just fixtures — a one-time manual verification
step, not part of the automated suite.

## Gotcha: don't run the worker while running e2e tests locally

`apps/api`'s e2e tests and a locally-running `apps/worker` process share the same dev
Postgres/Redis. Starting a crawl via the API during an e2e test run enqueues a **real** BullMQ
job; if a worker happens to be running in the background, it will pick that job up and crawl the
test's (usually nonexistent) fixture domain concurrently with the test's own assertions,
producing extra `CrawlPage` rows and flaky-looking failures that have nothing to do with the code
under test. Stop any local `apps/worker` process before running `pnpm --filter @searchenvil/api
run test:e2e` (or `pnpm test:e2e` at the root). This doesn't affect CI, where no worker process
is started.

## Fixtures

| Fixture | Purpose |
|---|---|
| `packages/crawler/src/fixtures/fixture-server.ts` | Deterministic HTTP responses for crawler tests |
| Cases covered by name in `crawler.spec.ts`, `parser.spec.ts`, `robots.spec.ts`, `sitemap.spec.ts` | Missing title, duplicate signals, `noindex`, broken links, redirects, missing `alt`, malformed JSON-LD, 404/500 |

Additional deterministic HTML/HTTP fixtures for `@searchenvil/audit-engine` rule tests land in
Phase 07.

## Running tests

```bash
pnpm test        # unit + integration, all packages
pnpm test:e2e     # API e2e (currently the only package with e2e tests)
```

CI (`.github/workflows/ci.yml`) runs `lint → typecheck → test → build → test:e2e` against real
Postgres/Redis service containers on every push/PR.
