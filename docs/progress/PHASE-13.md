# Phase 13 — Crawl Comparison

**Status: COMPLETE — gate passed.**

## Scope implemented

Answers `docs/PRODUCT.md`'s fifth question — "Did the website improve since the previous audit?"
— entirely from already-stored data, per its explicit requirement: "all derived from deterministic
stored data, never a generated narrative guess."

- **`CrawlsService.compare()`**: compares a crawl against an explicit `baselineCrawlId` or,
  when omitted, the most recent earlier `COMPLETED` crawl of the same site. Returns:
  - **Score deltas**: overall + per-category, `null` for a category missing from either side
    (rather than silently treating a missing category as 0).
  - **Issue deltas**: `new`/`resolved`/`persisting`, matched across crawls by the rule's stable
    `ruleKey` — not by `AuditIssue.id`, which is per-`AuditRun` and therefore meaningless to
    compare across two different runs.
  - **Page deltas**: `improved`/`worsened`, matched across crawls by `normalizedUrl` (page `id`s
    are also per-crawl) — a page's issue count going down/up between the two crawls. Only URLs
    present in **both** crawls are comparable; `matchedUrlCount`/`newPageCount`/`removedPageCount`
    make that scope explicit rather than silently dropping added/removed pages from the picture.
  - `404`s (not a default/empty comparison) when there's no earlier completed crawl to compare
    against, or when either crawl lacks a completed, scored audit run — a comparison that can't
    actually be computed should say so, not fabricate one.
- **`GET .../sites/:siteId/crawls/:crawlId/compare?baselineCrawlId=`** (new route on the existing
  crawl-scoped controller, alongside `score`/`issues`/`pages`).
- **Frontend**: `/app/projects/:projectId/audits` (new — the sidebar already linked here with
  nothing behind it) lists every crawl of the project's primary site with its score and status;
  a "Compare to previous" link appears next to any crawl that actually has an earlier
  completed-and-scored crawl to compare against. `/app/projects/:projectId/audits/:crawlId/compare`
  renders the full comparison: Search Health before/after with per-category deltas, three issue
  columns (new/resolved/persisting), and improved/worsened page lists.

## Key files

- `apps/api/src/crawls/crawls.service.ts` (`compare()`)
- `apps/api/src/crawls/crawls.controller.ts` (`GET :crawlId/compare`)
- `apps/api/test/crawl-comparison.e2e-spec.ts`
- `apps/web/src/app/app/projects/[projectId]/audits/page.tsx`
- `apps/web/src/app/app/projects/[projectId]/audits/[crawlId]/compare/page.tsx`
- `apps/web/src/lib/types.ts` (`CrawlComparison`, `ComparisonIssueSummary`, `ComparisonPageDelta`)

## Tests added

- `apps/api/test/crawl-comparison.e2e-spec.ts` (4): default-baseline comparison (score delta,
  category deltas, new/resolved/persisting issues, matched/new/removed page counts, no
  improved/worsened pages when both crawls behave identically per matched page), explicit
  `baselineCrawlId`, `404` when there's no earlier completed crawl, cross-org block.
- Workspace total: 61 e2e (up from 57).

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10 (new `audits` and `audits/[crawlId]/compare` routes compile and appear in the
Next.js route manifest). `pnpm typecheck`: 17/17. `pnpm lint`: 17/17. `pnpm test`: 17/17.
`pnpm test:e2e`: 11/11, 61 e2e tests total.

## Manual verification (Phase 13 gate: comparison reflects real deltas, not placeholders)

Ran the full API + worker + web stack. Triggered a second real crawl of the same
`https://example.com` site already used for Phase 12's live verification (same site, unchanged
content), then:

1. Called `GET .../crawls/:crawlId/compare` directly — confirmed a real, non-fabricated result:
   `scoreDelta: 0`, all `categoryDeltas` at `0`, all 5 issues present in both crawls correctly
   bucketed as `persisting` (none `new`/`resolved`, since nothing on the site changed), and
   `matchedUrlCount: 1` with `improved`/`worsened` both empty — exactly the expected outcome for
   comparing a site against an identical re-crawl of itself.
2. Logged into the running frontend, opened `/app/projects/:projectId/audits` — both crawls listed
   with scores, "Compare to previous" appearing only on the newer one (the older one has no earlier
   completed crawl to compare against, so the link correctly doesn't render for it).
3. Clicked through to the comparison page — the exact same numbers from step 1 render correctly:
   99 → 99 (±0), all 5 persisting issues with their severities, "1 page present in both crawls · 0
   new · 0 removed," empty Improved/Worsened lists.
4. Checked at 375×812 mobile width — clean, no overflow.
5. Stopped all three dev servers cleanly.

This intentionally exercises the "nothing changed" case precisely because it's the case most likely
to accidentally look broken or empty if the diffing logic were wrong (e.g. a bug that always
reports everything as "new" would be invisible in a comparison against a very different baseline
but obvious here).

## Architecture decisions

**Match by stable identity, not database id.** `AuditIssue.id` and `CrawlPage.id` are both
per-crawl (a fresh row is created every crawl). Comparing across crawls therefore has to match by
something stable across crawls instead: `AuditRule.ruleKey` for issues (the rule registry's key is
global and versioned, not per-run — see `docs/AUDIT_ENGINE.md`), and `CrawlPage.normalizedUrl` for
pages (the URL is the real-world identity of a page; its row id is just crawl-scoped bookkeeping).

**Default-to-previous-crawl UX, explicit baseline as an escape hatch.** Most of the time a user
wants "how did the last crawl compare to the one before it," so `baselineCrawlId` is optional and
defaults to the nearest earlier completed crawl. The query param exists for comparing against an
arbitrary earlier point, but the frontend built this phase only exercises the default path — an
arbitrary-pair picker UI wasn't in the Phase 13 gate and would be speculative scope.

**Page comparison is issue-count-based, not a per-page score.** There's no per-page Search Health
score in the data model (scoring is deliberately category-level, not page-level — see
`docs/SCORING.md`), so "did this page improve" is defined here as "does it have fewer issues
affecting it now than before." This is a real, meaningful signal (a page going from 3 issues to 0
genuinely improved) without inventing a new scoring concept this phase didn't ask for.

## Bugs found during self-audit and fixes made

- One TypeScript error caught by `pnpm build` on first attempt: `Badge`'s `tone` prop and
  `formatDelta` both take `number | null`, but `Record<string, number | null>` index access widens
  to `number | null | undefined` in strict mode. Fixed with `?? null` at both call sites in the
  comparison page — a one-line fix, not a design problem.
- No other bugs — the compare service's logic matched the live-verification expectations exactly
  on the first live run (correctly identified 0 new, 0 resolved, 5 persisting, 0 improved/worsened
  for two crawls of an unchanged site).

## Known limitations / technical debt

- Same "primary site only" scope as every project-level view since Phase 09 — the Audits list
  shows `overview.sites[0]`'s crawl history, not a multi-site picker.
- No arbitrary-pair comparison UI (pick any two crawls from a list) — only "compare to the
  immediately previous crawl" is exposed in the frontend, though the API supports any pair via
  `baselineCrawlId`. Not a gap against the Phase 13 gate, which only asks for before/after
  comparison, not a full comparison matrix.
- Removed pages (present in baseline, gone from current) and added pages (present in current, not
  in baseline) are counted but not listed individually — only the improved/worsened lists for
  *matched* pages are itemized. Itemizing added/removed pages too is a reasonable future refinement
  if requested, not attempted speculatively here.

## Security considerations

Reuses `OrgRolesGuard`/`MEMBER` and the crawl-scoped `getOrThrow` pattern (which already verifies
`crawl.siteId === siteId` for the target crawl and, via the same helper, for an explicit
`baselineCrawlId` too) — verified by the same cross-org-block test pattern used since Phase 04.

## Readiness for next phase

Gate met: crawl comparison reflects genuine, verified deltas (score, issues, pages) computed
entirely from stored data, confirmed against a real live re-crawl and rendered correctly in the
browser. Proceeding to Phase 14 (Reports).
