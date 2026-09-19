# Phase 04 — Projects & Onboarding

**Status: COMPLETE — gate passed.**

## Scope implemented

- **Projects API** (`apps/api/src/projects`): full CRUD scoped to an organization, `MEMBER` to
  create/read/update, `ADMIN` to delete. `ProjectsService.getOrThrow` scopes every lookup by
  `organizationId`, not just `id` — a foreign project ID resolves to `404`, closing the obvious
  IDOR hole of "does project X exist anywhere" leaking through a bare `findUnique`.
- **Sites API** (`apps/api/src/sites`): full CRUD nested under a project
  (`/organizations/:organizationId/projects/:projectId/sites`), same role split. `rootUrl` is
  validated as a well-formed `http(s)` URL (`class-validator`'s `IsUrl`) and enforced unique per
  project at the DB level (`Site.projectId_rootUrl`), surfaced as a `409` on duplicate.
- **Onboarding UI** (`apps/web`): a real, working flow — `/register` and `/login` pages calling
  the Phase 03 auth API, an `/onboarding` page that (once authenticated) takes a website URL,
  creates a `Project` named from the domain and a `Site` for that URL via the Phase 04 API, and
  a project overview page at `/app/projects/[projectId]` (wrapped in the Phase 02 `AppShell`,
  with a real project switcher label and an honest "No audits yet" state rather than a fake
  dashboard).
- `apps/web/src/lib/api-client.ts`: the shared fetch wrapper the rest of the frontend will build
  on — handles the session cookie, the CSRF double-submit header on mutating requests, and
  normalizes API error bodies into a typed `ApiError`.
- `packages/ui`: added `Input`/`Label`/`FieldError` form primitives.

## Key files

- `apps/api/src/projects/{projects.service,projects.controller,projects.module}.ts`
- `apps/api/src/sites/{sites.service,sites.controller,sites.module}.ts`
- `apps/web/src/lib/{api-client,types,derive-project-name}.ts`
- `apps/web/src/app/{register,login,onboarding}/page.tsx`
- `apps/web/src/app/app/projects/[projectId]/{layout,page}.tsx`

## Tests added

- `apps/api/test/projects-sites.e2e-spec.ts` (9 e2e tests, real Postgres) — project creation and
  validation, cross-organization project-creation block, website creation with URL validation
  (rejects non-`http(s)` schemes), duplicate-URL rejection, a foreign user reading a project via
  both their own org route (`404`) and the real owning org route (`403`) — proving the two
  distinct IDOR/tenant-boundary cases are both closed — a **cross-project IDOR test** (a site that
  belongs to Project A returns `404` when requested through Project B, even for the same
  authorized user in the same organization), and role-gated delete (`ADMIN` succeeds, and the
  deleted resource is confirmed gone via a follow-up `404`).
- `apps/web/src/lib/derive-project-name.spec.ts` (3 tests) — hostname extraction for the
  onboarding form's default project name.
- Workspace total: 5 (api unit) + 25 (api e2e) + 23 (shared) + 5 (ui) + 3 (web) = 61 automated
  tests, all passing.

## Commands executed and results

```
pnpm build     → 9/9 succeeded
pnpm typecheck → 15/15 succeeded
pnpm lint      → 15/15 succeeded
pnpm test      → 15/15 succeeded
pnpm test:e2e  → 10/10 succeeded (25 api e2e tests)
```

## Manual verification (Phase 04 gate: "a new user can reach a valid project ready for crawling")

Ran the real API (built, `node dist/main.js`) and web dev server together and drove the actual
browser through the full flow, not a mock:

1. `/register` — filled the form, submitted. Confirmed redirect to `/onboarding`.
2. `/onboarding` — confirmed it round-tripped `GET /auth/me` and `GET /organizations` (session
   cookie + CORS + credentials all working cross-port), then entered `https://example.com` and
   submitted "Forge my first audit."
3. Confirmed the "example.com is ready." confirmation screen, then clicked through to
   `/app/projects/:projectId`.
4. Confirmed the project shell renders with the **real** project name ("example.com") in both
   the sidebar switcher and the page heading, "1 website," and an honest "No audits yet" empty
   state (Phase 05/06/07 are what would make that state go away — nothing here pretends a crawl
   ran).

This confirms the actual product loop's entry point (Project → Site) works end-to-end through a
real browser, real API, and real Postgres — not just that the individual pieces build.

## Architecture decisions

No new ADRs this phase; built on ADR-001 through ADR-006.

## Bugs found during self-audit and fixes made

- `ProjectsController`'s `update` handler originally passed `dto.name ?? ""` straight to the
  service, which would have overwritten a project's name with an empty string on a `PATCH` that
  didn't include `name` (should be a no-op for omitted fields, not a destructive default).
  Changed the service to accept a partial `{ name?: string }` and pass it through to Prisma as-is.
- Next.js 15 changed dynamic route `params` to a `Promise` for **all** page/layout components
  (not just Server Components) as far as the generated type constraints are concerned; the
  project layout/page were written against the old synchronous shape and failed `next build`'s
  type check. Fixed by typing `params` as `Promise<{ projectId: string }>` and unwrapping with
  React's `use()` hook, per Next 15's own migration guidance.
- `packages/tsconfig/nextjs.json` didn't include the `DOM` lib (it was dropped from the shared
  base config in Phase 01 to fix an unrelated Node-only package), so `apps/web` compiled most
  code fine but failed on `e.target.value` in a form's `onChange` handler with `Property 'value'
  does not exist on type 'EventTarget & HTMLInputElement'` — the DOM lib types weren't actually
  loaded, just referenced generically enough elsewhere to not have surfaced yet. Added
  `"lib": ["ES2022", "DOM", "DOM.Iterable"]` to `nextjs.json` specifically (not the shared base,
  which stays DOM-free for the Node-only packages) — matching what `create-next-app` generates by
  default.

## Known limitations / technical debt

- The project layout/page currently discover which organization a project belongs to by fetching
  `/organizations` and probing each one — fine at "one or two orgs per user" scale, but should be
  replaced by a dedicated lookup once the Phase 09 dashboard needs real navigation between
  projects (tracked here rather than over-building a projects-index page nobody uses yet).
- No "create additional organization" UI/flow — an org is currently only created at registration.
  Revisit if multi-org membership turns out to matter for the initial release (see Phase 03's
  progress notes for the same open question).
- The onboarding flow creates exactly one project + one site per visit; there's no "add another
  website to this project" UI yet (the API supports it — `POST .../sites` — just no page for it).
  That's Phase 09/11 territory once there's a real project dashboard to add it to.

## Security considerations

- Reused the Phase 03 tenant-isolation model without modification — `OrgRolesGuard` already
  covers any route with an `:organizationId` param, so Projects/Sites inherited it for free.
- Added the narrower IDOR case Phase 03 didn't need to cover: a resource nested two levels deep
  (site → project → organization) where the *organization* check alone isn't enough — a member of
  the right org could otherwise reach another project's site by ID. Closed and tested (see
  "cross-project IDOR test" above).
- `rootUrl` validation at this layer is deliberately shape-only (`IsUrl`); it does not attempt
  SSRF protection, because nothing here fetches the URL. That protection belongs to and lands
  with the crawler in Phase 05 — noted explicitly in `docs/API.md` so it isn't mistaken for
  already being handled.

## Readiness for next phase

Gate met: a new user can register, land in onboarding, and end up with a real `Project` and
`Site` they can navigate to — verified via automated e2e tests and a live browser walkthrough.
Proceeding to Phase 05 (Crawler Foundation).
