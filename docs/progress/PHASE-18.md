# Phase 18 — Performance & Reliability Audit

**Status: COMPLETE — gate passed.**

## Scope implemented

An Explore-agent-assisted audit across five categories: N+1 query patterns, unbounded queries,
missing database indexes, BullMQ job reliability, and network/browser timeouts.

**Findings verified clean, no change needed**:
- **Indexes**: every foreign-key-like filter field in `packages/database/prisma/schema.prisma`
  (`crawlId`, `siteId`, `organizationId`, `projectId`, `auditRunId`, `ruleId`, `pageId`,
  `sourcePageId`, `targetPageId`, `userId`) is either explicitly `@@index`ed or covered by a
  `@@unique`/`@@id` prefix.
- **BullMQ reliability**: `packages/queue/src/queues.ts`'s `DEFAULT_JOB_OPTIONS` already sets
  `attempts: 3` with exponential backoff — a transient failure (e.g. a DB blip) retries rather
  than permanently failing the job.
- **Timeouts**: `packages/crawler/src/fetcher.ts` sets `headersTimeout`/`bodyTimeout` from
  `requestTimeoutMs`; `packages/performance/src/collector.ts` sets Playwright's default and
  navigation timeouts. Both already correct (confirmed, not assumed).

**Findings fixed — defensive query caps**: three `findMany` calls with no `take` were genuinely
unbounded at the query level, even though today's real-world data volumes keep them small:
- `IssuesService.list()` and `CrawlsService.listIssues()` — capped at `take: 500`. Bounded in
  practice by the fixed, small audit rule registry (`docs/AUDIT_ENGINE.md`, ~32 rules), but the
  query itself didn't enforce that — a defensive cap costs nothing and removes the implicit trust
  in an invariant living in a different file.
- `ReportsService.list()` — capped at `take: 50` (most recent crawls). Unlike the issues lists,
  this one genuinely grows without bound over a project's lifetime (one row per completed audit,
  indefinitely) — 50 is far more report history than a single flat list should ever need to show.

**Findings noted, deliberately not changed** (documented here rather than silently accepted):
- `sync-audit-rules.ts` and `process-audit-job.ts` each do one Prisma call per item in a loop
  (rule upsert, issue+occurrence creation respectively) instead of a single batched call. Both are
  partially justified — `process-audit-job.ts` specifically needs each `AuditIssue`'s generated id
  before it can insert that issue's occurrences, which a plain batch `createMany` can't give it.
  Refactoring either into a transaction-batched form is a real, boundable optimization but not one
  this audit found evidence of actually mattering yet (rule count and per-crawl issue count are
  both small, fixed-ish quantities) — flagged as a candidate for `docs/BACKLOG.md` rather than
  risking a rewrite of already-correct, well-tested job logic for a performance gain that hasn't
  been shown to be needed.
- `CrawlPage` full-crawl fetches in `map-crawl-to-site-input.ts`, `persist-crawl-result.ts`, and
  `process-performance-job.ts` are bounded today by `Crawl.maxPages` (default 200, max 1000 per
  `docs/API.md`) but not enforced at the DB query layer itself. Left as-is: `maxPages` is already
  a hard, validated ceiling on crawl size (see the crawl-start DTO), so these queries can never
  actually exceed it regardless of whether a `take` is also present — adding one would be
  redundant, not a real fix for a real gap.

## Key files

- `apps/api/src/issues/issues.service.ts`, `apps/api/src/crawls/crawls.service.ts`,
  `apps/api/src/reports/reports.service.ts` (added `take` caps)

## Tests added

None — these are defensive caps on already-correct queries, not new behavior; the existing e2e
suites for issues/crawls/reports continue to pass unchanged and already exercise the code paths
touched here.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10. `pnpm test`: 17/17. `pnpm test:e2e`: 11/11, 68 e2e tests (unchanged from
Phase 17 — no new tests needed for a defensive cap that doesn't change any test's expected
behavior at current data volumes).

## Architecture decisions

**Defensive caps over speculative rewrites.** The audit's most actionable output was "these three
queries have no ceiling," which is cheap and safe to fix directly. The N+1 patterns found are real
but not proven costly at today's scale, and fixing them risks destabilizing already-correct,
tested job logic for a performance gain with no evidence it's needed — the more disciplined choice
is to note them for `docs/BACKLOG.md` rather than refactor speculatively this late in the build.

## Bugs found during self-audit and fixes made

Three unbounded `findMany` queries capped, as described above. No other bugs found — every other
audited category (indexes, job retry/backoff, network/browser timeouts) was already correct.

## Known limitations / technical debt

- The N+1 patterns in `sync-audit-rules.ts` and `process-audit-job.ts`, and the uncapped-but-
  `maxPages`-bounded `CrawlPage` fetches — both discussed above, tracked as conscious, documented
  trade-offs rather than gaps.

## Security considerations

None new — this phase is purely about query bounding and reliability, not authorization or data
exposure (already covered by Phase 17).

## Readiness for next phase

Gate met: a real audit across query patterns, indexing, job reliability, and timeouts found and
fixed genuine (if low-severity) unbounded-query gaps, and confirmed the rest of the system's
reliability posture (indexes, retries, timeouts) was already sound. Proceeding to Phase 19 (Full
Regression).
