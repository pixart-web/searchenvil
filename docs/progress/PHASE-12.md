# Phase 12 — Performance

**Status: COMPLETE — gate passed.**

## Scope implemented

- **`packages/performance`** (new package): `selectSamplePages()` (shallowest-first, 200-status-only,
  capped at `DEFAULT_MAX_SAMPLES = 5`, deterministic tie-break by URL) and
  `createPlaywrightCollector(executablePath)` — a real-Chromium metrics collector that injects a
  `PerformanceObserver` via `page.addInitScript()`, navigates, and extracts TTFB/DCL/load/LCP/CLS.
  Never throws; always returns `{status, ...}` (`FAILED` with `errorMessage` on any browser-level
  problem), and always closes the browser in a `finally`.
- **`PagePerformance` model** (Prisma): one row per sampled page, `PerformanceStatus` enum
  (`PENDING`/`RUNNING`/`COMPLETED`/`FAILED`/`SKIPPED`), 1:1 with `CrawlPage`.
- **`apps/worker/src/performance/process-performance-job.ts`**: reads a crawl's pages, samples via
  `selectSamplePages()`, and sequentially collects + persists metrics for each sampled page only —
  every other crawled page is left with no `PagePerformance` row at all (not a placeholder/zeroed
  one), which is the signal the rest of the system uses to know "not sampled" vs. "sampled and
  clean."
- **Independent bounded concurrency**: a new `PERFORMANCE` BullMQ queue with its own
  `PERFORMANCE_WORKER_CONCURRENCY` (default 1), decoupled from `CRAWL`/`AUDIT`. Combined with the
  5-page sampling cap, one performance job launches at most 5 sequential browser page loads —
  the worst case is bounded regardless of crawl size.
- **Deployment-optional, not hard-required**: `apps/worker/src/main.ts` gates performance job
  processing on `CHROMIUM_EXECUTABLE_PATH` being set. Unset → the worker logs a warning and skips
  wiring up the `PERFORMANCE` worker entirely; crawl/audit processing is completely unaffected.
  Uses `playwright-core` (not `playwright`) so the package never auto-downloads a ~150MB Chromium
  binary as an install side effect.
- **4 new audit rules** (`packages/audit-engine/src/rules/performance.ts`): `poor-lcp` (>4000ms,
  HIGH), `high-cls` (>0.25, MEDIUM), `slow-ttfb` (>800ms, MEDIUM), `performance-analysis-failed`
  (NOTICE, fires when a sampled page's analysis failed). All three metric rules guard on
  `status === "COMPLETED"` so an unsampled page never produces a false verdict either way.
- **Per-category denominator in scoring** (the one real architectural change this phase, beyond
  "add a new category"): `computeSearchHealth`/`prioritizeIssues` now take the whole `SiteInput`
  (not just a page count) and compute `affectedRatio` against `performanceSampleSize` for
  PERFORMANCE issues and `totalPages` for everything else — otherwise a real, universal
  performance problem sampled on e.g. 5 of 200 pages would be diluted into looking minor. See
  "Architecture decisions" below and `docs/SCORING.md`.
- **API + frontend** (added after noticing the sidebar's "Performance" nav link had nowhere to go —
  every prior phase paired new backend data with a real UI, and this phase shouldn't be the
  exception): `GET .../projects/:projectId/performance` returns
  `{ crawlId, totalPagesCrawled, samples[] }`, and `/app/projects/:projectId/performance` renders
  each sampled page's TTFB/LCP/CLS as color-coded badges (thresholds match the audit rules exactly,
  kept in sync deliberately) or a "analysis failed" badge, plus an explicit "N of M pages sampled"
  line so the bounded-sampling design is visible to the user, not just true in the backend.

## Key files

- `packages/database/prisma/schema.prisma` (`PagePerformance`, `PerformanceStatus`) +
  migration `20260919212327_add_page_performance`
- `packages/performance/src/{types,select-sample-pages,collector,index}.ts`
- `apps/worker/src/performance/process-performance-job.ts`
- `apps/worker/src/main.ts` (new `PERFORMANCE` queue/worker, `CHROMIUM_EXECUTABLE_PATH` gate)
- `apps/worker/src/crawl/process-crawl-job.ts` (enqueues the performance job alongside audit, only
  on `COMPLETED`)
- `packages/audit-engine/src/rules/performance.ts`
- `packages/audit-engine/src/{scoring,priority}.ts` (signature change: `(site, issues)` instead of
  `(issues, totalPages)`)
- `apps/worker/src/audit/map-crawl-to-site-input.ts` (maps `PagePerformance` → `PagePerformanceInput`)
- `apps/api/src/performance/{performance.service,performance.controller,performance.module}.ts`
- `apps/web/src/app/app/projects/[projectId]/performance/page.tsx`

## Tests added

- `packages/performance/src/select-sample-pages.spec.ts` (6)
- `apps/worker/src/performance/process-performance-job.spec.ts` (4)
- `packages/audit-engine/src/rules/performance.spec.ts` (11)
- `packages/audit-engine/src/scoring.spec.ts` — 1 renamed + 1 new test for the PERFORMANCE
  sample-relative denominator
- `packages/audit-engine/src/rule-registry.spec.ts` — updated category-coverage assertion
- `apps/api/test/performance.e2e-spec.ts` (3) — sampled rows plus true crawl-size count, foreign-org
  block, empty state for a project with no completed crawl
- Workspace total: 57 e2e (up from 54); full unit-test count grew by 21 across
  `performance`/`audit-engine`/`worker`.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10. `pnpm typecheck`: 17/17. `pnpm lint`: 17/17. `pnpm test`: 17/17 (all unit
suites, including the new `packages/performance` and performance-rule suites). `pnpm test:e2e`:
11/11, 57 e2e tests total including the 3 new performance ones.

## Manual verification (Phase 12 gate: "Performance processing is bounded and cannot overwhelm workers")

1. Downloaded and verified a real Chromium binary (`playwright install chromium`), confirming a
   standalone `page.goto('https://example.com')` actually navigates and extracts a title.
2. Started the full API + worker stack with `CHROMIUM_EXECUTABLE_PATH` pointed at that binary and
   confirmed the worker's "not configured" warning did **not** appear (grepped the log — no match,
   the correct/expected outcome).
3. Registered a user, created a project/site for `https://example.com`, and triggered a real crawl
   via the live API. Worker log shows the full pipeline firing in order: crawl completes → audit
   job runs → performance job samples the one eligible page (`sampledCount: 1` out of
   `candidateCount: 1`) → a real Chromium page load executes → `status: "COMPLETED"`.
4. Queried the resulting `PagePerformance` row directly from Postgres — genuine, non-fabricated
   metrics for a fast static page: `ttfbMs: 136, lcpMs: 174, cls: 0`. Not a fixture, not a mock —
   an actual browser measured an actual page.
5. Logged into the running frontend as that same user and navigated to
   `/app/projects/:projectId/performance`: the exact same numbers (TTFB 136ms, LCP 174ms, CLS 0)
   render correctly as color-coded badges, with the "1 of 1 crawled page sampled" context line.
   Confirmed at both desktop and 375×812 mobile widths — no overflow.
6. Stopped both dev servers cleanly.

This is the same "prove it with a live run, not just unit tests" pattern used in every prior phase
(Phases 05–11), extended here to also prove the new frontend surface renders real data, not just
the backend pipeline.

## Architecture decisions

**Per-category scoring denominator.** Realized during implementation (self-review, not a failing
test) that reusing the existing `affectedRatio = occurrences / totalPages` for PERFORMANCE issues
would badly understate real problems: performance analysis only ever samples ~5 pages regardless of
how large the crawl is, so "5 of 5 sampled pages have poor LCP" would be diluted into "5 of 200" if
divided by the full crawl. Fixed by changing `computeSearchHealth`/`prioritizeIssues` to accept the
whole `SiteInput` and pick a per-category denominator: `performanceSampleSize` for PERFORMANCE,
`totalPages` for every other category. This is a genuine, deliberate deviation from "every category
uses the same formula," documented explicitly in `docs/SCORING.md` and `docs/PERFORMANCE.md` so
it doesn't read as an inconsistency later.

**Sampling logic lives in the worker, not the queue payload.** `PerformanceJobData` was simplified
to just `{ crawlId }` (originally scoped as `{ crawlId, pageIds }`) — the sampling decision
(`selectSamplePages()`) happens inside `processPerformanceJob` when the job actually runs, not at
enqueue time. This keeps `process-crawl-job.ts`'s enqueue call trivial and keeps the sampling
policy in one place.

**`playwright-core` over `playwright`.** A deliberate dependency choice, not an oversight —
`playwright` auto-downloads Chromium on `pnpm install`, which is wrong for a monorepo where most
packages/apps never touch a browser. Browser provisioning is treated as an explicit deployment
prerequisite (`CHROMIUM_EXECUTABLE_PATH`), with graceful degradation (warn + skip) if absent.

## Bugs found during self-audit and fixes made

- TypeScript DOM lib was missing in `packages/performance` (its collector references `window`/
  `PerformanceObserver` inside Playwright page-context callbacks) — fixed by adding `lib: ["ES2022",
  "DOM"]` to its `tsconfig.json`, the same pattern already used for `apps/web`.
- The installed Chromium revision didn't match what `playwright-core@1.49.1` expected — fixed by
  running `playwright install chromium` to fetch the matching revision, then verifying it actually
  works with a standalone navigation test before wiring it into the worker.
- Missing `@searchanvil/performance` workspace dependency in `apps/worker/package.json` — added and
  reinstalled.
- A test's `cleanup` callback returned `Promise<Organization>` instead of `Promise<void>` (a type
  error, not a runtime bug) — wrapped in an explicit block.
- Cascading fixture/type updates after the `computeSearchHealth`/`prioritizeIssues` signature
  change: two inline `SiteInput`/`PageInput` fixtures in `process-audit-job.spec.ts` were missing
  the new `performance` field (TS2741); `process-audit-job.ts` had a now-unused `totalPages`
  variable (ESLint). Both fixed; caught by typecheck/lint, not by a passing-but-wrong test.
- `rule-registry.spec.ts`'s category-coverage test and `scoring.spec.ts`'s PERFORMANCE-exclusion
  test were both asserting the *old* (pre-this-phase) reason PERFORMANCE was absent ("no rules
  exist yet"). Updated the assertions and test names to reflect the real, current behavior
  ("excluded only until sampled"), and added a new test proving PERFORMANCE *is* scored once
  sampled data exists.
- Gap found in self-audit before considering the phase done: the sidebar already linked to
  `/app/projects/:projectId/performance`, but no API endpoint or frontend page existed for it yet —
  every backend feature since Phase 09 has shipped with a real UI, so this was fixed rather than
  left as a dangling nav link, adding `apps/api/src/performance/*` and the frontend page described
  above.

## Known limitations / technical debt

- No on-demand re-sampling from the UI — sampling only happens automatically as part of the
  post-crawl pipeline, same cadence as audit.
- No filmstrip/waterfall/resource-level breakdown — this is a Core Web Vitals summary, not a full
  Lighthouse report. Documented as intentionally out of scope in `docs/PERFORMANCE.md`.
- No network-throttling profiles (e.g. simulated 3G) — a single desktop-equivalent profile is used
  for every sample. Tracked in `docs/BACKLOG.md` if picked up later.
- Same "primary site only" scope as Overview/Issues/Pages (Phases 09–11) for the new API route —
  not a new limitation, just inherited.

## Security considerations

- Reuses `OrgRolesGuard`/`MEMBER` and the same cross-org-block test pattern established since
  Phase 04; verified explicitly in `performance.e2e-spec.ts`.
- The Chromium collector navigates to URLs the crawler already discovered and validated (same-site,
  already SSRF-checked at crawl time via `packages/crawler`'s `createSafeLookup` — see
  `docs/SECURITY.md`) — it does not accept or navigate to arbitrary user-supplied URLs.
- The collector never executes page-supplied script outside the browser's own sandbox and never
  evaluates anything beyond reading standard Performance API values back out — no `eval` of page
  content, no credential handling.

## Readiness for next phase

Gate met: performance processing is bounded (5-page sampling cap × independent
low-concurrency queue) and cannot overwhelm workers, verified by a real live run against
`https://example.com` end-to-end through the frontend, plus 21 new automated tests. Proceeding to
Phase 13 (Crawl Comparison).
