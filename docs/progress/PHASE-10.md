# Phase 10 — Issues

**Status: COMPLETE — gate passed.**

## Scope implemented

- **`IssuesService`/`IssuesController`** (`apps/api/src/issues`): project-level issue
  listing/detail, resolving the project's primary site's latest **completed** audit run (same
  scope as Phase 09's Overview). Supports severity filtering (multi-value, comma-separated),
  category filtering (multi-value), case-insensitive title/summary search, and sorting by
  priority/severity/affected-page-count in either direction — matching section 17's requirements
  exactly.
- **Issue detail** includes the rule's full explanatory text (what/why/how-to-fix) plus every
  affected page (`AuditOccurrence` → `CrawlPage`) with its stored evidence — the concrete "move
  from summary to exact affected URLs and evidence" the Phase 10 gate asks for.
- **Frontend**: `/app/projects/:projectId/issues` (filterable/searchable/sortable list) and
  `/app/projects/:projectId/issues/:issueId` (detail — What was found / Why it matters / How to
  fix it / Affected pages, each in its own card, plus raw evidence rendered as formatted JSON
  when present).
- **Refactor**: extracted the "which of my organizations owns this project" lookup (previously
  duplicated in the Phase 04/09 project layout and overview page) into a shared
  `resolveProjectOrg()` helper, used by all three pages that need it now.

## Key files

- `apps/api/src/issues/{issues.service,issues.controller,issues.module}.ts`
- `apps/api/src/issues/dto/list-issues-query.dto.ts`
- `apps/web/src/app/app/projects/[projectId]/issues/{page.tsx,[issueId]/page.tsx}`
- `apps/web/src/lib/resolve-project-org.ts`

## Tests added

- `apps/api/test/issues.e2e-spec.ts` (10) — default priority ordering, single and multi-value
  severity filtering, category filtering, case-insensitive search, sorting by affected-page-count,
  invalid-severity rejection (`400`), issue detail with occurrences/evidence, tenant isolation,
  and a `404` for an issue id that's real but belongs to a different project (an IDOR check, same
  pattern established since Phase 04).
- Workspace total: 45 e2e (up from 35); grand total across the workspace is now 209 unit/integration
  + 45 e2e = 254 automated tests.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

## Manual verification (Phase 10 gate: "user can move from summary to exact affected URLs and evidence")

Ran the full stack and drove a real browser from registration through onboarding (which now
auto-starts a crawl, per Phase 09) to the Issues list for a live audit of `https://example.com`,
then clicked into "Missing meta description" and confirmed the detail page shows the exact
affected URL (`https://example.com/`) with its status code — the concrete click-through path the
gate describes, using real audit data, not seeded fixtures.

Also tested at mobile width (375×812), applying the `flex-wrap` lesson from Phase 09's overflow
bug preventatively to both new pages — confirmed no horizontal overflow on either the issue cards
(list page) or the detail cards, unlike Phase 09's first attempt.

## Architecture decisions

No new ADRs — straightforward extension of the crawl-scoped `AuditIssue`/`AuditOccurrence` API
(Phase 08) to a project-level, filtered view, and reuse of the `OrgRolesGuard` pattern.

## Bugs found during self-audit and fixes made

- None this phase required a runtime fix — the `flex-wrap` pattern learned from Phase 09's mobile
  overflow bug was applied from the start in both new pages' layouts, and the mobile check
  confirmed it worked rather than finding a new instance of the same bug.
- Minor cleanup during review: an unused `orgId` state variable and a dead
  `{orgId ? null : null}` branch were left over from an earlier draft of the issues list page;
  removed rather than shipped.

## Known limitations / technical debt

- Filter/search/sort state lives in local React state, not the URL — reloading the issues page
  resets filters, and a filtered view can't be bookmarked/shared. Reasonable Phase 16 (Product
  Polish) candidate; not blocking this phase's gate, which is about filtering/searching/sorting
  working correctly, not about URL state persistence.
- Same "primary site only" scope as Phase 09 — inherits that known limitation rather than
  introducing a new one.

## Security considerations

Reuses `OrgRolesGuard`/`MEMBER` like every other project-scoped resource. The issue-detail IDOR
check (an issue that's real but belongs to a different project must 404, not leak its data) is
explicitly tested, following the same pattern established for projects/sites/crawls since Phase 04.

## Readiness for next phase

Gate met: a user can go from the issues summary to the exact affected URLs and evidence for any
issue, verified both by automated tests and a real browser session against a live audit. Proceeding
to Phase 11 (Pages) — the page inventory and per-page technical profile that issue detail's
affected-page links will eventually point into.
