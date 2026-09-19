# Phase 09 — Overview Dashboard

**Status: COMPLETE — gate passed.**

## Scope implemented

- **`GET .../projects/:projectId/overview`** (`apps/api/src/projects/project-overview.service.ts`):
  aggregates everything the dashboard needs into one call — per site, its latest scored crawl
  (Search Health + category scores + top 5 Forge Priorities + issue counts by severity/category)
  and its recent crawl history — so the frontend never does an N+1 waterfall (site → latest crawl
  → score → issues) itself.
- **Real Overview page** (`apps/web/src/app/app/projects/[projectId]/page.tsx`, replacing the
  Phase 04 static placeholder): Search Health gauge with category breakdown, Forge Priorities list
  (severity/impact/effort badges), issues-by-category breakdown, and recent crawls — all from real
  API data, with an honest empty state when no crawl has run yet.
- **`SearchHealthGauge`** (`packages/ui`): a restrained circular progress ring, color-banded
  (green ≥80, amber ≥50, red below), matching the design system rather than a generic chart
  library widget.
- **Onboarding now actually runs the first audit**: previously (Phase 04, before the crawler/audit
  engine existed) onboarding just created the project/site and said crawling "arrives in a later
  build phase." Now that it exists (Phases 05–08), onboarding starts the crawl immediately after
  creating the site — completing section 21's "Create organization → Create project → Add website
  → Run first audit" flow for real, and the confirmation copy was corrected to match.

## Key files

- `apps/api/src/projects/project-overview.service.ts`
- `apps/web/src/app/app/projects/[projectId]/page.tsx`
- `apps/web/src/lib/{format,types}.ts`
- `packages/ui/src/primitives/SearchHealthGauge.tsx`

## Tests added

- `apps/api/test/project-overview.e2e-spec.ts` (3) — an empty-but-valid overview for a site with
  no crawls yet, a fully populated overview (score, top issues, category counts, recent crawls)
  seeded the way the real worker leaves data, and tenant isolation.
- `apps/web/src/lib/format.spec.ts` (7) — category label formatting (`INTERNAL_LINKING` → "Internal
  Linking"), relative-time formatting (just now / minutes / hours / days / null).
- Workspace total: 35 e2e (up from 32) + 10 new web unit tests; grand total across the workspace
  is now 209 unit/integration + 35 e2e = 244 automated tests.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

## Manual verification (Phase 09 gate: "dashboard is useful with real stored audit data")

Ran the full stack (API + worker + web dev server) and drove an actual browser through
registration → onboarding → the real dashboard, using a live crawl of `https://example.com` (not
seeded fixture data):

- Confirmed the Search Health gauge renders 99/100 in green, with the exact category breakdown
  (Content 95, others 100) matching the Phase 08 live-proof numbers.
- Confirmed Forge Priorities lists exactly the 5 real issues, correctly ranked (missing meta
  description first), each with its severity/impact/effort badges.
- Confirmed "Issues by category" and "Recent crawls" both reflect real, just-completed data.
- Tested at mobile width (375×812) per section 28 — **found and fixed a real horizontal-overflow
  bug**: the Forge Priorities issue rows used `shrink-0` on their badge group, which (combined
  with flexbox's implicit `min-width: auto` on flex children) forced the whole row — and by
  extension the whole page — wider than the viewport, silently cutting off every right-aligned
  value on the page (the category score numbers were fully invisible, positioned beyond the
  overflowed edge, not just visually cramped). Fixed by making the issue row `flex-wrap` so badges
  drop to their own line on narrow screens instead of forcing overflow, and re-verified the fix
  removes the cutoff for both the badges and (as a side effect, confirming the root cause) the
  category scores.

This is exactly the kind of bug that only surfaces by actually looking at a real narrow-viewport
render — the desktop layout, and even a cursory glance at the component in isolation, looked
completely correct.

## Architecture decisions

No new ADRs — this phase is straightforward composition of already-established API (crawl-scoped
resources, `OrgRolesGuard`) and UI (`packages/ui` primitives, `AppShell`) patterns.

## Bugs found during self-audit and fixes made

- The mobile horizontal-overflow bug described above — caught by actually testing at mobile
  width per the verification workflow, not by code review (the flexbox `min-width: auto` +
  `shrink-0` interaction is subtle enough that it reads as correct on inspection).
- Onboarding's confirmation copy claimed crawling "arrives in a later build phase," which had
  become false as of Phase 05 but nobody had gone back to update it. Since the functionality now
  genuinely exists, fixed the flow to actually use it (auto-starting the first crawl) rather than
  just correcting the wording — the more complete, and more honest, fix.

## Known limitations / technical debt

- The overview aggregates the *first* site in a project (`sites[0]`); multi-site dashboards
  (showing/switching between several websites in one project) aren't built yet — consistent with
  onboarding only ever creating one site per project so far (noted in Phase 04's progress doc as
  the same open question). Revisit if/when a "add another website" UI is prioritized.
- No polling/auto-refresh on the overview page — a user has to reload to see a crawl finish. A
  reasonable Phase 16 (Product Polish) candidate rather than blocking this phase's gate, which is
  about the dashboard being useful with real data, not about live progress updates (that's more
  the Audit Experience's "New Audit" flow, not Overview).

## Security considerations

No new attack surface — the overview endpoint reuses `OrgRolesGuard`/`MEMBER` like every other
project-scoped resource, verified by the same tenant-isolation test pattern used throughout.

## Readiness for next phase

Gate met: the dashboard is genuinely useful with real, live-audited data — verified in an actual
browser, including a real mobile-layout bug found and fixed, not just asserted from API test
responses. Proceeding to Phase 10 (Issues) — the detailed, filterable issue list and issue detail
view that Forge Priorities' "top 5" links out to.
