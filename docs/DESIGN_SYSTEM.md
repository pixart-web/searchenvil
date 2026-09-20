# Design System

SearchAnvil is dark-first and premium — graphite/forged-metal backgrounds, steel typography, a
copper/ember signature accent, and restrained violet for data/interactive moments. It should not
read as a generic purple SaaS template, and shadcn/ui (where introduced) is infrastructure only —
SearchAnvil's own look lives in `packages/ui`, not in unstyled primitives.

## Tokens

Source of truth: `packages/ui/src/tokens/colors.ts` (for non-Tailwind consumers, e.g. future
chart code) mirrored in `apps/web/tailwind.config.ts` (`theme.extend.colors`).

| Token | Hex | Use |
|---|---|---|
| `forge-950` | `#090A0F` | Page background |
| `forge-900` | `#101119` | Panel/card background, sidebar/topbar |
| `forge-850` | `#151620` | Hover surface |
| `forge-800` | `#1C1D29` | Borders, subtle fills |
| `steel-500`…`steel-100` | `#74798C`→`#E8E9EF` | Body text, from muted to primary |
| `ember-600`…`ember-400` | `#BD6F32`→`#E9A45F` | Primary brand accent (CTAs, active states) |
| `violet-500` | `#865DFF` | Secondary accent for data/interaction, used sparingly |
| `success` / `warning` / `danger` | `#36B978` / `#E3A72F` / `#E65353` | Semantic state only |

Typography: Geist Sans for UI text, Geist Mono for technical metrics/labels (see
`apps/web/src/app/globals.css` font variables and the `SEARCHANVIL` wordmark treatment).

Radii are restrained (`4px`/`6px`/`10px` — see `tailwind.config.ts` `borderRadius`); avoid pill
shapes, heavy gradients, and glassmorphism.

## Components (`packages/ui`)

| Component | File | Notes |
|---|---|---|
| `Button` | `primitives/Button.tsx` | variants: primary/secondary/ghost/danger; `isLoading` state |
| `Badge` | `primitives/Badge.tsx` | `severity` (critical/high/medium/low/notice) or explicit `tone` |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `primitives/Card.tsx` | |
| `Skeleton` | `primitives/Skeleton.tsx` | loading placeholder, respects `prefers-reduced-motion` |
| `Spinner` | `primitives/Spinner.tsx` | inline loading indicator |
| `StatusState` | `primitives/StatusState.tsx` | the single shared shape for empty/error/warning/cancelled/denied screens (section 32) |
| `Sidebar`, `Topbar`, `AppShell`, `ProjectSwitcher` | `layout/*.tsx` | responsive product shell — see below |

All components accept `className` and merge it safely via `cn()` (`clsx` + `tailwind-merge`), so
call sites can override spacing/width without fighting specificity.

### Framework independence

`packages/ui` has no hard dependency on `next/link`. Layout components accept a `linkComponent`
prop (`LinkComponent` type in `layout/types.tsx`); `apps/web` injects `next/link` via
`src/components/nav-link.tsx` so navigation gets client-side transitions and prefetching, while
the design-system package itself stays framework-agnostic.

## Application shell

`AppShell` composes `Sidebar` + `Topbar`: a fixed sidebar at the `lg` breakpoint and up, an
off-canvas sidebar with a dimmed overlay below it, toggled from the topbar's hamburger button.
Active nav state is derived from the current path (`isActive`, unit-tested in
`layout/Sidebar.spec.ts`), not passed manually per route.

Primary product navigation (section 12 of the build spec): Overview, Audits, Issues, Pages,
Performance, Reports, plus Settings (top-level, not project-scoped). See
`PROJECT_NAV_ITEMS()` in `layout/Sidebar.tsx`.

## Dev-only reference pages

- `/dev/showcase` — every primitive rendered with its variants, for visual regression checks.
- `/dev/shell` — the `AppShell` wired up in isolation, for verifying responsive behavior before
  real project routing exists (Phase 04).

Neither is linked from product navigation and neither should be treated as a real product route.

## Accessibility baseline (expanded in Phase 17)

- Visible focus ring on every interactive element (`:focus-visible` in `globals.css`), not just
  removed and never replaced.
- `Sidebar` nav is `<nav aria-label="Primary">` with `aria-current="page"` on the active item.
- `StatusState` uses `role="alert"` for error/denied states and `role="status"` otherwise, so
  screen readers announce them appropriately.
- Mobile nav toggle is a real `<button>` with `aria-label`, not a clickable `<div>`.
