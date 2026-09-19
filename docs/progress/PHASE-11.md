# Phase 11 — Pages

**Status: COMPLETE — gate passed.**

## Scope implemented

- **`PagesService`/`PagesController`** (`apps/api/src/pages`): project-level page inventory,
  resolving the primary site's latest **completed crawl** (page facts exist as soon as the crawl
  finishes — unlike Issues, this doesn't need the audit run to have completed too). Supports
  pagination, URL search, `indexableOnly` filtering, and HTTP status-class filtering (`2xx`
  through `5xx`).
- **Page technical profile** (`getPage`): every crawled fact for one URL — HTTP (status, final
  URL, redirect hops, response time, size), indexability (indexable flag, meta robots,
  X-Robots-Tag, canonical), metadata (title, description, language), content (word count,
  headings, H1), images (with missing-alt count), structured data (with invalid-block count),
  outbound links, an **inbound-link count** computed via `CrawlLink.targetPageId` (a real
  cross-page join, not stored redundantly on the page row), and **every issue affecting this
  page** (joining `AuditOccurrence` → `AuditIssue` → `AuditRule` for the page's crawl's audit
  run) — the "technical SEO profile" section 18 asks for.
- **Frontend**: `/app/projects/:projectId/pages` (paginated, searchable, filterable-by-status list
  with indexability badges) and `/app/projects/:projectId/pages/:pageId` (the full profile, laid
  out as HTTP / Indexability / Metadata / Content / Links / Images & Structured Data cards, plus
  an "Issues affecting this page" section linking each one to its Phase 10 issue detail page).

## Key files

- `apps/api/src/pages/{pages.service,pages.controller,pages.module}.ts`
- `apps/api/src/pages/dto/list-pages-query.dto.ts`
- `apps/web/src/app/app/projects/[projectId]/pages/{page.tsx,[pageId]/page.tsx}`

## Tests added

- `apps/api/test/pages.e2e-spec.ts` (9) — alphabetical listing, status-class filtering,
  indexable-only filtering, URL search, pagination, a full technical-profile response (facts,
  inbound-link count, affecting issues) for a page that has both, images on a separate page's
  profile, tenant isolation, and the by-now-standard cross-project IDOR check (a real page id
  belonging to a different project must `404`).
- Workspace total: 54 e2e (up from 45); grand total across the workspace is now 209 unit/integration
  + 54 e2e = 263 automated tests.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

## Manual verification (Phase 11 gate: "individual crawled URL can be fully inspected")

Ran the full stack and drove a real browser from registration through a live audit of
`https://example.com` to the Pages list, then into the single crawled page's detail view.
Confirmed every field matches the real crawl exactly (19-word count, 1 heading, H1 "Example
Domain", language "en", 1 outbound link, 0 inbound links, 0 images) and that all 5 real issues
from Phases 08–10 correctly appear in "Issues affecting this page," each linking to its own issue
detail page. Checked at mobile width (375×812) — clean, no overflow, confirming the `flex-wrap`
pattern from Phase 09/10 generalizes to this page's layout too.

## Architecture decisions

No new ADRs — same pattern as Issues (Phase 10): a project-level service resolving the primary
site's latest relevant crawl/run, reusing `OrgRolesGuard`.

## Bugs found during self-audit and fixes made

None required a runtime fix this phase — build, typecheck, lint, and every e2e test passed on
first implementation, and the live browser verification matched expectations exactly on the first
try (no overflow, no incorrect data). The `flex-wrap`/`min-w-0` patterns established in Phases 9–10
were applied from the start rather than discovered by trial and error again.

## Known limitations / technical debt

- Same "primary site only" scope as Overview/Issues (Phases 09–10) — not a new limitation, just
  inherited.
- `inboundLinkCount` counts links from *this crawl only* (a link from a page outside the crawled
  set, e.g. an external site linking in, isn't counted — nor could it be, since the crawler by
  design only records internal-site link discovery). This is the correct, intentional scope for a
  technical SEO audit tool, not a gap — worth stating explicitly so it doesn't get "fixed" into
  something incorrect later.

## Security considerations

Reuses `OrgRolesGuard`/`MEMBER` and the established cross-resource IDOR-check pattern, verified by
the same test structure used for every other project-scoped resource since Phase 04.

## Readiness for next phase

Gate met: an individual crawled URL can be fully inspected — every fact, its issues, and its link
relationships — verified both by automated tests and a real browser session against a live audit.
Proceeding to Phase 12 (Performance) — the first category with genuinely new backend work
(sampled Lighthouse-equivalent analysis) rather than another view over already-persisted crawl
data.
