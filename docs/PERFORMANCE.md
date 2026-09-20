# Performance analysis

`@searchanvil/performance` + `apps/worker/src/performance` add real-browser Core Web Vitals
sampling on top of the crawl's static facts. This is deliberately a separate concern from the
crawler (which only ever fetches HTML over HTTP) and from the audit engine (which only ever
interprets facts already collected) — see `docs/ARCHITECTURE.md` ("Crawler ≠ Audit Engine"). The
performance package is a third kind of fact-collector: one that requires a real browser instead of
a plain HTTP fetch.

## Why sampled, not exhaustive

The build spec is explicit: avoid running expensive browser analysis indiscriminately across every
crawled URL. A real Chromium page load is orders of magnitude more expensive than the crawler's
plain HTTP fetch, and most sites have highly correlated performance characteristics across pages
(same template, same asset pipeline, same server) — analyzing every one of a 500-page crawl would
be slow, costly, and not meaningfully more informative than a small representative sample.

`selectSamplePages()` (`packages/performance/src/select-sample-pages.ts`) picks the sample:

- Only pages that returned HTTP 200 (no point measuring a page that didn't load).
- Sorted shallowest-depth-first, tie-broken alphabetically by normalized URL — deterministic, and
  biased toward the pages most likely to represent the site's home/landing experience.
- Capped at `DEFAULT_MAX_SAMPLES = 5`.

This runs inside `processPerformanceJob`, not in the caller — the queue only ever carries a
`crawlId`, and the worker decides what to sample when the job runs.

## Bounded concurrency

The `PERFORMANCE` BullMQ queue has its own worker concurrency setting
(`PERFORMANCE_WORKER_CONCURRENCY`, default **1**), independent of `CRAWL`/`AUDIT` concurrency.
Combined with the 5-page sampling cap, a single performance job launches at most 5 sequential
Chromium page loads — the worst case is bounded regardless of how large the underlying crawl was.
Pages within one job are processed **sequentially**, not in parallel, to keep one job's memory/CPU
footprint predictable.

## What's measured

`createPlaywrightCollector()` (`packages/performance/src/collector.ts`) launches Chromium, injects
a `PerformanceObserver` via `page.addInitScript()` before navigation (so it's present from the
first paint, not attached after the fact), navigates, waits briefly for observers to settle, then
reads:

| Metric | What it is |
|---|---|
| `ttfbMs` | Time to first byte |
| `domContentLoadedMs` | DOMContentLoaded timing |
| `loadTimeMs` | Full `load` event timing |
| `lcpMs` | Largest Contentful Paint |
| `cls` | Cumulative Layout Shift |

The collector **never throws** — a navigation timeout, a crash, or any other failure is caught and
turned into `{ status: "FAILED", errorMessage }`. The browser is always closed in a `finally`
block. A failed sample is still a result, persisted and visible, not a silently dropped job.

## Thresholds (rule severity)

`packages/audit-engine/src/rules/performance.ts` uses Google's published Core Web Vitals "poor"
thresholds, not project-invented numbers:

| Rule | Fires when | Severity | Confidence |
|---|---|---|---|
| `poor-lcp` | LCP > 4000ms | HIGH | 0.9 |
| `high-cls` | CLS > 0.25 | MEDIUM | 0.85 |
| `slow-ttfb` | TTFB > 800ms (project guideline, not a Google-published CWV threshold) | MEDIUM | 0.7 |
| `performance-analysis-failed` | a sampled page's browser run failed | NOTICE | 1.0 |

All three metric rules guard on `status === "COMPLETED"` — an unsampled or failed page never
produces a false verdict either way (see `docs/AUDIT_ENGINE.md`, "PERFORMANCE rules only judge
sampled pages").

## Scoring: a sample-relative denominator, not crawl-relative

This is the one place `docs/SCORING.md`'s penalty formula deviates from "every other category": a
PERFORMANCE issue's `affectedRatio` is computed against the **sample size**
(`performanceSampleSize`, e.g. 5), not the full crawl's page count (which could be hundreds). If it
used the full crawl count, "5 of 5 sampled pages have poor LCP" — a real, universal problem — would
be diluted to "5 of 200," making it look minor. `computeSearchHealth`/`prioritizeIssues` both take
the whole `SiteInput` (not just a page count) specifically so they can pick the right denominator
per category. See `docs/SCORING.md` for the full formula.

The PERFORMANCE category itself is excluded from the overall Search Health average entirely until
at least one page has been sampled — a project with no performance data yet shows no PERFORMANCE
score, never a default 100 that would misrepresent "we haven't checked" as "it's clean."

## Deployment requirement: `CHROMIUM_EXECUTABLE_PATH`

The performance package depends on `playwright-core` (not `playwright`), deliberately — the plain
`playwright` package auto-downloads a ~150MB Chromium binary as an npm install side effect, which
is unacceptable for a monorepo where most packages never touch a browser. `playwright-core` ships
no browser; a Chromium binary must be provisioned separately and its path passed via
`CHROMIUM_EXECUTABLE_PATH`.

`apps/worker/src/main.ts` checks this env var at startup:

- **Set**: the `PERFORMANCE` worker runs normally, using `createPlaywrightCollector(path)`.
- **Unset**: the worker logs a warning and skips wiring up performance job processing entirely.
  Crawl and audit processing are completely unaffected — performance is treated as an optional
  capability, not a hard dependency, so a deployment without a provisioned browser degrades
  gracefully instead of crashing.

**The production worker Docker image (`apps/worker/Dockerfile`) provisions Chromium automatically
(SA-RC21 finding #2)** — no manual setup needed. The image is built on Microsoft's official
Playwright base image (`mcr.microsoft.com/playwright:v1.63.0-noble`, pinned to the exact
`playwright-core` version this workspace resolves to — see `pnpm-lock.yaml`), which ships
Chromium and every OS-level dependency it needs (fonts, shared libs) already installed at image
build time. Nothing is downloaded when a container starts. The container's entrypoint resolves
`CHROMIUM_EXECUTABLE_PATH` at startup via `playwright-core`'s own path-resolution API — a local
filesystem lookup against the already-installed browser, not a network call — so it's correct
regardless of the exact Chromium revision folder name. This was verified with a real `docker
build` and a real running container (see `docs/DEPLOYMENT.md`'s Docker verification section),
not just written and assumed correct.

Running the worker outside this Docker image (bare `node`/`pnpm dev`, or a custom image) still
requires provisioning Chromium manually (e.g. `npx playwright install chromium`) and setting
`CHROMIUM_EXECUTABLE_PATH` yourself, exactly as described above.

## Live verification (Phase 12 gate)

Ran the full API + worker stack with a real, provisioned Chromium binary
(`CHROMIUM_EXECUTABLE_PATH` set), registered a user, created a project/site for
`https://example.com`, and triggered a real crawl. The worker log shows the full pipeline firing in
order — crawl completes → audit job runs → performance job samples the one eligible page → a real
Chromium page load executes and completes. The resulting `PagePerformance` row was queried directly
from Postgres and contains genuine, non-fabricated metrics for a fast static page:

```json
{
  "status": "COMPLETED",
  "ttfbMs": 136,
  "domContentLoadedMs": 139,
  "loadTimeMs": 139,
  "lcpMs": 174,
  "cls": 0
}
```

The same data was then confirmed rendering correctly end-to-end in the browser at
`/app/projects/:projectId/performance` (both desktop and 375×812 mobile widths, no overflow),
proving the full path — real browser → Postgres → API → frontend — works, not just the isolated
collector unit tests.

## What's intentionally out of scope for this release

- **Filmstrip/waterfall traces, resource-level breakdowns** — this is a Core Web Vitals summary,
  not a full Lighthouse report; deeper diagnostics are a possible future addition, not attempted
  here.
- **Per-device/network-throttling profiles** (e.g. simulated 3G) — a single desktop-equivalent
  profile is used; configurable throttling profiles are tracked in `docs/BACKLOG.md` if picked up
  later.
- **Re-sampling on demand from the UI** — sampling only happens as part of the automatic
  post-crawl pipeline today.
