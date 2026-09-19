# Phase 16 — Product Polish

**Status: COMPLETE — gate passed.**

## Scope implemented

A self-audit pass across the whole frontend, using an Explore agent to survey consistency,
dead links/controls, accessibility gaps, leftover TODOs, and 404 handling. Loading/error/empty
states were already consistent across every project page (Spinner → `StatusState`), so the pass
focused on fixing the real, concrete findings rather than manufacturing busywork:

- **Fixed a real returning-user bug**: `login/page.tsx` unconditionally redirected to `/onboarding`
  after every sign-in — a returning user with existing projects was sent straight back to the
  "create your first project" form every single time, rather than to their project. There was no
  page for the actual gap this exposed: nothing showed a user their existing projects at all if
  they had more than none. Registration's redirect to `/onboarding` was correct as-is (a freshly
  registered org always has zero projects) and was left unchanged.
- **New `/app/projects` list page**: the real entry point after login. If the org has zero
  projects it forwards straight to `/onboarding` (first-run behavior unchanged); otherwise it lists
  every project with a link into it, plus a "New project" action. `login/page.tsx` now redirects
  here instead of unconditionally to `/onboarding`.
- **Wired up the previously-dead `ProjectSwitcher` chevron**: it rendered as a clickable control
  since Phase 04 with no `onOpen` handler ever passed to it — clicking it did nothing. Now
  `apps/web/src/app/app/projects/[projectId]/layout.tsx` passes `onOpen={() =>
  router.push("/app/projects")}`, giving it a real destination (a simple navigation, not an
  in-place dropdown menu — the number of projects a user has is expected to stay small, so a
  dropdown wasn't worth building for this).
- **Custom `not-found.tsx`**: previously a genuinely mistyped URL fell through to Next's bare
  default 404, visually inconsistent with the rest of the branded product. Added a real one using
  the existing `StatusState` component and a "Back to home" link.
- **Accessibility**: added `aria-label` to the Issues page's search input and its severity/category
  `<select>`s, and to the Pages list's search input — all four previously relied on `placeholder`
  alone, which isn't programmatically associated with the field for assistive tech. (Login/
  register/onboarding's inputs already had proper `<Label htmlFor>` pairing — not a gap there.)
- **Gated `/dev/shell` and `/dev/showcase` behind `NODE_ENV !== "production"`**: these are
  development-only component/shell reference pages (documented as such in `docs/DESIGN_SYSTEM.md`,
  "neither should be treated as a real product route"), but were reachable in a production build
  with no guard at all. Both now call `notFound()` when `NODE_ENV === "production"`.

## Key files

- `apps/web/src/app/app/projects/page.tsx` (new)
- `apps/web/src/app/login/page.tsx` (redirect target)
- `apps/web/src/app/app/projects/[projectId]/layout.tsx` (`ProjectSwitcher` wiring)
- `packages/ui/src/layout/Topbar.tsx` (updated doc comment, no behavior change in the package itself)
- `apps/web/src/app/not-found.tsx` (new)
- `apps/web/src/app/app/projects/[projectId]/issues/page.tsx`,
  `apps/web/src/app/app/projects/[projectId]/pages/page.tsx` (aria-labels)
- `apps/web/src/app/dev/shell/page.tsx`, `apps/web/src/app/dev/showcase/page.tsx` (production guard)

## Tests added

None — every change here is either a redirect-target fix, a wiring fix, an accessibility
attribute, or a route guard; none introduce new business logic warranting a dedicated unit test.
Verified instead by the full existing suite (nothing regressed) plus live browser verification of
the actual user-facing behavior, which is the more meaningful proof for this kind of fix.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10 — the route table now shows a real `○ /_not-found` (previously the framework
default, unlisted) and the new `○ /app/projects` route. `pnpm typecheck`: 17/17. `pnpm lint`:
17/17. `pnpm test`: 17/17 (unchanged). `pnpm test:e2e`: 11/11, 66 e2e tests (unchanged — nothing
here touches the API's behavior, only frontend routing/wiring).

## Manual verification (Phase 16 gate: no dead ends, no dead controls)

Ran the full API + web stack and, as the same returning user from Phases 12–15's live
verifications:

1. Logged in — landed on the new `/app/projects` page showing the real existing project, not the
   onboarding form. This is the actual bug fix, confirmed live rather than just by reading the
   diff.
2. Clicked into the project, then clicked the sidebar's `ProjectSwitcher` (the project name +
   chevron) — correctly navigated back to `/app/projects`, where previously nothing happened at
   all on click.
3. Navigated to a deliberately nonexistent path — got the new on-brand 404 page (wordmark +
   `StatusState` + "Back to home"), not Next's bare default.
4. Stopped both dev servers cleanly.

## Architecture decisions

**No dropdown menu for the project switcher.** The Explore agent's finding was that the chevron
was inert, not that a dropdown was missing per se — the simplest correct fix is a navigation to a
real list page, which now exists. Building an in-place dropdown would be a reasonable future
enhancement if a user typically has many projects, but nothing in this product's scope (a single
onboarding-created project per org is the common case) justifies that complexity now.

**Onboarding stays the single "create a project" flow; the fix lives at the redirect layer, not
inside onboarding itself.** `onboarding/page.tsx` was already correct in isolation (it always shows
the create-project form, which is exactly what it should do when reached deliberately, e.g. via
`/app/projects`'s "New project" button). The bug was entirely that *login* forced every user
through it regardless of whether they needed to be. Fixing the redirect target, not onboarding's
own logic, is the smaller, more correct change.

## Bugs found during self-audit and fixes made

- **The returning-user-forced-into-onboarding bug** (described above) — the most significant
  finding this phase, caught by the Explore agent noticing `login/page.tsx` always redirected to
  `/onboarding` with no check for existing projects, then confirmed as a genuine repro by tracing
  `onboarding/page.tsx`'s logic (it never checked project count either — it would have silently
  let a returning user create a *second*, redundant project every time they signed in).
- The dead `ProjectSwitcher` chevron, the bare-default 404, the un-labeled search inputs, and the
  unguarded dev routes — all fixed as described above.
- Two findings from the audit were deliberately **not** changed: the mailer's dev-stub behavior
  (`apps/api/src/auth/mailer.service.ts`) is intentional and already marked as such in code — real
  email delivery is out of scope for this project per the master build constraints (no production
  deployment, no third-party service credentials), not an oversight to "fix." And no TODO/FIXME
  comments were found anywhere in the codebase, so there was nothing to triage there.

## Known limitations / technical debt

- `/app/projects` has no search/pagination — reasonable for the expected "a handful of projects
  per org" scale (the same scale assumption already documented for the org-resolution pattern in
  `docs/progress/PHASE-09.md`); would need revisiting if that assumption changes.
- No dedicated print stylesheet for the Reports page (noted already in `docs/progress/PHASE-14.md`)
  — still true, not addressed this phase since it wasn't part of this pass's findings.

## Security considerations

No new attack surface — `/app/projects` reuses the existing `apiFetch`/`resolveProjectOrg`-style
session-cookie auth (implicitly, via listing only the orgs the session actually belongs to), and
the dev-route guards reduce production attack surface rather than expanding it.

## Readiness for next phase

Gate met: the concrete rough edges found in a real audit (a genuine returning-user bug, a dead
control, an unbranded 404, accessibility gaps, unguarded dev routes) are fixed and verified live,
not just diagnosed. Proceeding to Phase 17 (Security Audit).
