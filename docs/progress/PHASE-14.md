# Phase 14 — Reports

**Status: COMPLETE — gate passed.**

## Scope implemented

A Report is a deterministic, shareable snapshot of one crawl's Search Health and issues — same
"no generated narrative, only stored data" principle established in Phase 13's Crawl Comparison
(`docs/progress/PHASE-13.md`). Built for the project's primary site, same scope convention as
Overview/Issues/Pages/Performance/Audits since Phase 09.

- **`ReportsService`**:
  - `list()` — every `COMPLETED` crawl with a score, newest first (a crawl without a completed,
    scored audit run is not a report yet — it's simply excluded, not shown as broken/empty).
  - `get(crawlId)` — the full report: site identity, crawl metadata, overall + per-category Search
    Health, the previous scored crawl and score delta (both `null`, not fabricated, when there
    isn't one), and every issue for that crawl's audit run ranked by `priorityScore` descending
    with its rule's recommendation text attached.
  - Both `404` (not an empty/default report) when the crawl doesn't belong to this project's
    primary site or lacks a completed, scored audit.
- **CSV export** (`GET .../reports/:crawlId/export.csv`): the same report's issues as a real,
  RFC 4180-compliant CSV — a small hand-written `toCsv()` helper (`apps/api/src/reports/csv.util.ts`)
  quotes any field containing a comma, quote, or newline and doubles embedded quotes, rather than
  naively joining with commas (which would silently corrupt a row the moment an issue title or
  recommendation happened to contain one). Served with `Content-Type: text/csv` and
  `Content-Disposition: attachment` so it downloads as a file, not renders inline.
- **Frontend**: `/app/projects/:projectId/reports` (new — the sidebar already linked here with
  nothing behind it, same situation Performance and Audits were in before their phases) lists every
  available report by date and score. `/app/projects/:projectId/reports/:crawlId` renders the full
  report — Search Health with category breakdown and delta-since-previous, then every issue with
  its severity, category, affected-page count, summary, and recommendation — plus a "Download CSV"
  link that navigates directly to the export endpoint (a plain link, not `apiFetch`, since a file
  download is a browser navigation, not a JSON call; the session cookie rides along automatically
  on the same-site top-level GET).

## Key files

- `apps/api/src/reports/{reports.service,reports.controller,reports.module,csv.util}.ts`
- `apps/api/test/reports.e2e-spec.ts`
- `apps/web/src/app/app/projects/[projectId]/reports/{page.tsx,[crawlId]/page.tsx}`
- `apps/web/src/lib/api-client.ts` (`apiUrl()` — new, for the CSV download link)
- `apps/web/src/lib/types.ts` (`Report`, `ReportListItem`, `ReportIssue`)

## Tests added

- `apps/api/test/reports.e2e-spec.ts` (5): list scoped to completed+scored crawls, full report
  shape (site/crawl/score/issues ranked by priority, `null` previousCrawl/scoreDelta with no
  earlier crawl), CSV export with a **deliberately** comma-and-quote-containing rule title/
  recommendation to prove the escaping actually works end-to-end (not just in the unit-level
  `toCsv()` logic), cross-org block, 404 for a crawl id outside the project.
- Workspace total: 66 e2e (up from 61).

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10 (new `reports` and `reports/[crawlId]` routes compile). `pnpm typecheck`:
17/17. `pnpm lint`: 17/17. `pnpm test`: 17/17. `pnpm test:e2e`: 11/11, 66 e2e tests total.

## Manual verification (Phase 14 gate: a real, downloadable, correct report)

Ran the full API + web stack (worker wasn't needed — reused the two already-completed, scored
crawls from Phases 12–13's live verification of the same `https://example.com` project).

1. Logged into the frontend, opened `/app/projects/:projectId/reports` — both crawls listed with
   their real scores (99, 99).
2. Opened the newer crawl's report — renders the real category breakdown (Content 95, others 100),
   "0 since 20m ago" (the genuine delta against the previous identical crawl — 0, not blank, since
   nothing changed), and all 5 real issues with their actual recommendation text.
3. Fetched the CSV export directly with the browser's own session cookie — got back a real,
   correctly-quoted CSV with the exact 5 issues, matching the on-page list exactly, with proper
   `Content-Disposition: attachment` and `Content-Type: text/csv` headers.
4. Checked the report page at 375×812 mobile width — clean, no overflow, all cards stack
   correctly.
5. Stopped both dev servers cleanly.

## Architecture decisions

**CSV escaping is hand-written, not a dependency.** RFC 4180 quoting is ~10 lines of well-defined
logic (`packages/`-free, lives directly in `apps/api/src/reports/csv.util.ts`); pulling in a CSV
library for this would be a heavier dependency than the problem warrants. Directly tested by the
"quote/comma in the title" e2e case rather than trusted blindly.

**Reports reuse Phase 13's "primary site" and "scored audit run" conventions rather than inventing
new ones.** A report is fundamentally "the same data Issues/the Audits comparison page already
show, packaged for sharing/export" — there was no reason to build a parallel data-access pattern
for it. `ReportsService` is intentionally the smallest possible service that assembles what's
already computed elsewhere (score, issues) into one response shape, plus the CSV projection of it.

**Download link is a plain `<a href>`, not a fetch-then-blob dance.** `apiFetch` assumes a JSON
response; forcing a file download through it would mean fetching the CSV as text, constructing a
`Blob`, and synthesizing a download — extra client-side complexity for something a browser already
does correctly with a same-site GET and a `Content-Disposition: attachment` header from the server.
Added `apiUrl()` to `api-client.ts` as the one small building block this needed.

## Bugs found during self-audit and fixes made

None required a runtime fix — build, typecheck, lint, and every e2e test (including the
comma/quote CSV-escaping case, the one most likely to reveal a hand-written-CSV bug) passed on
first implementation, and the live browser/CSV verification matched expectations exactly on the
first run.

## Known limitations / technical debt

- Same "primary site only" scope as every project-level view since Phase 09.
- No PDF export — CSV (for spreadsheets) and the web report page itself (which prints reasonably
  via the browser's own print dialog, though no dedicated print stylesheet was built) cover the
  "shareable snapshot" need without adding a PDF-rendering dependency. Documented as a possible
  future addition if requested, not attempted speculatively here.
- No public/unauthenticated share links — a report is only reachable by an authenticated org
  member, consistent with every other project-scoped view; a "share with a client who has no
  account" link would be a deliberate, separate feature with its own access-control design, not
  something to bolt on here without being asked.

## Security considerations

Reuses `OrgRolesGuard`/`MEMBER` and the same cross-org-block + cross-project-404 test pattern used
since Phase 04. The CSV endpoint sets `Content-Type: text/csv` (not `text/html`) and
`Content-Disposition: attachment`, so a browser downloads it as a file rather than rendering
issue titles/recommendations as HTML — relevant because those strings ultimately originate from
audit rule definitions in code (trusted), not user input, but the header discipline is correct
regardless of provenance.

## Readiness for next phase

Gate met: a real, correctly-escaped, downloadable report reflecting genuine stored data, verified
live end-to-end (API → browser render → CSV download) at desktop and mobile widths. This completes
the five core product questions from `docs/PRODUCT.md` (health, what's wrong, what to fix first,
which pages, did it improve) with a real feature behind every one. Proceeding to Phase 15 (Public
Website).
