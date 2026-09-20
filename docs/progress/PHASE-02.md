# Phase 02 — Design System & Application Shell

**Status: COMPLETE — gate passed.**

## Scope implemented

- SearchAnvil brand tokens wired end to end: `packages/ui/src/tokens/colors.ts` (source of truth)
  mirrored in `apps/web/tailwind.config.ts`; dark-first `<html class="dark">`, Geist
  Sans/Mono font variables in `apps/web/src/app/globals.css`.
- Design-system primitives in `packages/ui`: `Button` (4 variants, loading state), `Badge`
  (severity-driven or explicit tone), `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Skeleton`,
  `Spinner`, `StatusState` (the shared empty/error/warning/cancelled/denied shape used across the
  product per section 32).
- Responsive application shell: `Sidebar` (fixed at `lg`+, off-canvas with overlay below it),
  `Topbar` (hamburger toggle, brand mark, project-switcher slot, right-aligned user slot),
  `AppShell` (composes both, owns open/close state), `ProjectSwitcher` (trigger only — the
  dropdown itself needs real project data, landing in Phase 04).
- Framework-agnostic link injection: `packages/ui` has no hard dependency on `next/link`;
  `apps/web/src/components/nav-link.tsx` adapts `next/link` to the `LinkComponent` shape so the
  design-system package stays reusable/testable without a Next.js runtime.
- Primary nav item set for the product loop (Overview, Audits, Issues, Pages, Performance,
  Reports) via `PROJECT_NAV_ITEMS()`.
- Two dev-only reference routes in `apps/web`: `/dev/showcase` (every primitive + variant) and
  `/dev/shell` (the `AppShell` wired up in isolation) — neither linked from product nav.
- `docs/DESIGN_SYSTEM.md` documenting tokens, components, the shell, and the accessibility
  baseline.

## Key files

- `packages/ui/src/tokens/colors.ts`, `apps/web/tailwind.config.ts`
- `packages/ui/src/primitives/{Button,Badge,Card,Skeleton,Spinner,StatusState}.tsx`
- `packages/ui/src/layout/{Sidebar,Topbar,AppShell,types}.tsx`
- `apps/web/src/components/nav-link.tsx`
- `apps/web/src/app/dev/{showcase,shell}/*`

## Tests added

- `packages/ui/src/layout/Sidebar.spec.ts` (5 cases) — `isActive()` path-matching logic: exact
  match, nested match, prefix-string false positive rejection (`/issues` must not match
  `/issues-archive`), unrelated path, explicit `matchPrefix` override.

## Commands executed and results

```
pnpm install  → clsx, tailwind-merge added to @searchanvil/ui
pnpm build     → 9/9 succeeded
pnpm typecheck → 15/15 succeeded
pnpm lint      → 15/15 succeeded
pnpm test      → 15/15 succeeded (23 shared + 5 ui + 1 api tests passing)
```

## Manual verification (Phase 02 gate: "UI is visually coherent and responsive")

Ran `apps/web` dev server and drove it through the built-in browser:

- `/dev/showcase` at desktop width — confirmed forge/steel/ember/violet/success/warning/danger
  tokens render as specified, button variants and loading state, severity/tone badges, card,
  skeleton/spinner loading states, and both `StatusState` kinds.
- `/dev/shell` at desktop width — sidebar fixed and visible, project switcher trigger, primary
  nav rendered, topbar user slot.
- `/dev/shell` at mobile width (375×812) — sidebar hidden behind a hamburger button; tapping it
  opens the off-canvas panel with a dimmed overlay over the page content, confirming the
  responsive behavior described in `docs/DESIGN_SYSTEM.md` actually works, not just compiles.

## Architecture decisions

- Layout components take an injectable `linkComponent` rather than importing `next/link`
  directly, so `packages/ui` has no framework coupling and its logic (like `isActive`) is
  unit-testable in plain Node/Vitest without a Next.js test environment.

## Bugs found during self-audit and fixes made

- `packages/ui/src/layout/types.ts` contained JSX but had a `.ts` extension, which `tsc` rejects
  outright (`'>' expected` / `Unterminated regular expression literal` — the parser reads `<a`
  as a comparison, not a JSX tag). Renamed to `types.tsx`.
- `LinkComponentProps` didn't declare `onClick`, but `Sidebar` needs to close the mobile overlay
  when a nav link is tapped. Added `onClick?: () => void` to the shared type instead of leaving
  it off `next/link`'s wrapper (which would have silently swallowed the prop) or widening the
  type to `any`.
- `isActive()`'s prefix check originally would have treated `/issues` as a prefix match for
  `/issues-archive` (string `startsWith`, no boundary check). Fixed by requiring a `/` immediately
  after the prefix (`currentPath.startsWith(`${prefix}/`)`) and covered it with a regression test
  rather than trusting the "obviously correct" first version.

## Known limitations / technical debt

- `ProjectSwitcher` is a static trigger button; the actual dropdown listing an org's projects
  needs real data and lands in Phase 04.
- No dark/light theme toggle — SearchAnvil is dark-first by design (section 11); a light mode is
  not in scope for this release.
- Accessibility coverage here is a baseline (focus rings, ARIA roles/labels, semantic nav) — the
  full WCAG 2.2 AA pass is Phase 17.

## Security considerations

No new attack surface — this phase is presentation-only, no data fetching or user input yet.

## Readiness for next phase

Gate met: the design system renders correctly and responsively, verified in-browser at desktop
and mobile widths, with the interactive off-canvas behavior confirmed working (not just visually
present). Proceeding to Phase 03 (Authentication & Multi-Tenancy).
