# Phase 06 — Crawl Storage & Observability

**Status: COMPLETE — gate passed.**

## Scope implemented

- **Crawl persistence** (`apps/worker/src/crawl/persist-crawl-result.ts`): upserts each crawled
  page into `CrawlPage` (by `crawlId` + `normalizedUrl`), derives `h1` from the headings list and
  `isIndexable` from `metaRobots`/`X-Robots-Tag` (a direct-signal derivation, not an audit
  judgment — see `indexability.ts`), and persists images/structured-data blocks per page. Links
  are resolved and persisted in a separate final pass (`finalizeCrawlLinks`) once every page
  exists, so a link to a page crawled later in the run still resolves its `targetPageId`
  correctly.
- **Live progress**: `Crawl.pagesCrawled` increments as each page is persisted (via
  `@searchanvil/crawler`'s new `onPageCrawled` hook), not just once at the end — a crawl in
  progress is genuinely observable, not a black box until it finishes.
- **Status lifecycle** (`apps/worker/src/crawl/process-crawl-job.ts`): `PENDING → DISCOVERING →
  CRAWLING → COMPLETED`, or `FAILED` (with `errorMessage` captured) / `CANCELLED`, with
  `startedAt`/`finishedAt` set at the right points.
- **Cancellation**: the worker polls the crawl's DB status every ~2s (configurable) and aborts an
  `AbortController` if it observes `CANCELLED` — wired through `@searchanvil/crawler`'s new
  `signal` option on `runCrawl`, which stops the `ConcurrencyPool` from starting new fetches
  (in-flight ones finish). A crawl cancelled before the worker even picks up the job is a no-op
  (checked at the very start of `processCrawlJob`).
- **Dependency-injected crawl execution**: `processCrawlJob` takes `runCrawl` as a dependency
  (production wiring uses the real `@searchanvil/crawler`; tests inject a fake one) — this is
  what makes the full status/persistence/cancellation lifecycle testable deterministically against
  real Postgres without any network/SSRF concerns.
- **Crawls API** (`apps/api/src/crawls`): start (enqueues a real BullMQ job via a new
  `QueueModule`), list, get, cancel, and paginated page listing/detail — all organization-scoped
  through the existing `OrgRolesGuard`.

## Key files

- `apps/worker/src/crawl/{persist-crawl-result,process-crawl-job,indexability}.ts`
- `apps/worker/src/main.ts` (now runs the real crawl pipeline, replacing the Phase 01 placeholder)
- `apps/api/src/crawls/{crawls.service,crawls.controller,crawls.module}.ts`
- `apps/api/src/common/queue/queue.module.ts`
- `packages/crawler/src/concurrency-pool.ts`, `crawler.ts` (added `signal`/`onPageCrawled` to
  `runCrawl`)

## Tests added

- `apps/worker/src/crawl/indexability.spec.ts` (5) — noindex detection from either signal,
  case-insensitivity, other-directives-don't-count.
- `apps/worker/src/crawl/process-crawl-job.spec.ts` (4, real Postgres) — **persists pages,
  resolves links (including a link to a page crawled after it), and images/structured data
  correctly; ends `COMPLETED`; ends `FAILED` with the thrown error's message captured; ends
  `CANCELLED` when cancellation is requested mid-run (proving the abort signal actually
  propagates into the injected `runCrawl`); is a no-op for an already-cancelled crawl.**
- `apps/api/test/crawls.e2e-spec.ts` (6) — start with defaults, `maxPages`/`maxDepth` overrides
  and out-of-range rejection, list ordering, cancel + idempotent re-cancel, tenant isolation
  (start/list blocked for a foreign org — `404` under the caller's own authorized org per the
  established Phase 04 pattern, `403` under a truly foreign org), and paginated page listing +
  single-page detail with its relations, including that a foreign user gets `403` on both.
- `packages/crawler`: 3 new tests locking in a real bug fix (see below) — `ssrf.spec.ts` now
  covers both the single-result and array-result shapes of the custom DNS lookup, plus a
  multi-answer response where one address is blocked.
- Workspace total: 76 unit/integration + 31 e2e = 107 automated tests (was 45+25 crawler/api-e2e
  before this phase), all passing.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green, repeated clean
```

## Manual end-to-end proof (Phase 06 gate: "a completed crawl can be fully inspected from persisted data")

Built and ran the real API and worker processes together, registered a real user via HTTP,
created a project and a site pointed at `https://example.com`, started a crawl via the real API,
and polled it to completion — a genuine live-internet crawl, not a fixture:

```
GET .../crawls/:id       → {"status":"COMPLETED","pagesCrawled":1,"startedAt":...,"finishedAt":...}
GET .../crawls/:id/pages → title: "Example Domain", h1: "Example Domain",
                            headings: [{level:1,text:"Example Domain"}], language: "en",
                            wordCount: 19, statusCode: 200, isIndexable: true
```

This is the strongest form of the gate: not just that test fixtures round-trip correctly, but
that the real pipeline (API → BullMQ → worker → `@searchanvil/crawler` → SSRF-safe DNS → Postgres
→ API read-back) works against the actual internet.

## Architecture decisions

No new ADRs — this phase wires together decisions already recorded (ADR-004 job payloads carry
IDs only, ADR-005 sessions, ADR-007 SSRF/concurrency).

## Bugs found during self-audit and fixes made

- **The manual end-to-end proof above caught a real bug the automated test suite had missed**:
  every real crawl failed with `fetchError: "Invalid IP address: undefined"`. Root cause:
  `createSafeLookup`'s custom DNS resolver always replied in the single-address `(err, address,
  family)` shape, but Node's own `net`/`tls` connect internals (via undici's Happy Eyeballs
  dual-stack logic) sometimes call the lookup function requesting the array form
  (`{ all: true }` → `(err, addresses[])`). Replying in the wrong shape corrupted whatever the
  caller did next, surfacing as an unrelated-looking error deep in the socket layer. This is
  exactly the kind of bug that unit tests of the blocklist logic in isolation (`ssrf.spec.ts`'s
  existing 8 tests, all still passing) cannot catch — it's about *protocol conformance* between
  the lookup function and its caller, which only shows up when something real actually calls it
  through the full undici/Node stack. Fixed by having `createSafeLookup` respect the caller's
  `all` option and reply in whichever shape was requested; refactored `createSafeLookup` to take
  an injectable resolver so this is now covered by three deterministic, offline unit tests
  (`ssrf.spec.ts`) instead of only being catchable by a live network crawl. **Lesson applied**:
  the manual verification step in this phase's testing strategy (see `docs/TESTING.md`) isn't
  redundant with the automated suite — it's specifically what caught this.
- `processCrawlJob` originally fired `persistCrawlPage` from the `onPageCrawled` callback without
  awaiting it (`void persistCrawlPage(...)`), then called `finalizeCrawlLinks` immediately after
  `runCrawl` resolved. Since persistence promises were still in flight, link target resolution
  could run before all pages existed, silently leaving some `targetPageId`s null that shouldn't
  be. Fixed by collecting the promises and `Promise.all`-ing them before finalizing links; caught
  during implementation review, not by a failing test (worth having anyway, but the fix predates
  the test that would have caught it).
- `Prisma`'s generated types for `Json` fields rejected `HeadingFact[]`/`OpenGraphFact[]` (typed
  arrays) directly — `InputJsonValue`'s structural type doesn't accept an array with a specific
  element interface without a cast. Cast to `object` at the call site rather than loosening the
  underlying fact types.

## Known limitations / technical debt

- Cancellation has up to ~2s latency (the polling interval) between the API request and the
  worker actually observing it — acceptable for this release; a pub/sub notification (Redis
  keyspace notifications or a dedicated control channel) would make it instant if that ever
  matters.
- Local e2e tests and a locally-running worker share dev infrastructure and can interfere with
  each other (documented as a gotcha in `docs/TESTING.md`, discovered when it caused a real,
  confusing test failure during this phase's own validation — not just a hypothetical).
- No retry-with-backoff distinction between transient fetch failures and permanent ones at the
  crawl level yet (BullMQ's own job-level retry from `packages/queue`'s `DEFAULT_JOB_OPTIONS`
  applies to the whole crawl job, not per-page) — acceptable for now; per-page retry logic is a
  reasonable Phase 12 (performance/reliability) candidate if it proves necessary.

## Security considerations

The bug fixed in this phase (DNS lookup shape mismatch) was a correctness bug, not a security
regression — `isBlockedAddress` and the blocking behavior itself were never wrong; the SSRF
protection continued to correctly refuse connections, it just also broke legitimate ones in a
specific undici code path. No new attack surface: crawl start/cancel are `MEMBER`-gated and
organization-scoped like every other resource in this API.

## Readiness for next phase

Gate met: a completed crawl (from a real live crawl, not just a fixture) is fully inspectable
through the API from persisted Postgres data — status, page facts, images, structured data, and
resolved links. Proceeding to Phase 07 (Audit Engine) — the crawler's facts now have somewhere
real to land, ready for interpretation.
