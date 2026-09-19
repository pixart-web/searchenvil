# Phase 03 — Authentication & Multi-Tenancy

**Status: COMPLETE — gate passed.**

## Scope implemented

- Session-based authentication (`apps/api/src/auth`): register, login, logout, `GET /auth/me`,
  password reset request/confirm. Passwords hashed with `scrypt` + random salt
  (`password.util.ts`); sessions are random tokens stored server-side as a SHA-256 hash with
  expiry (`session.util.ts`). See `docs/SECURITY.md` for the full model and ADR-005.
- CSRF protection via double-submit cookie, enforced in `SessionAuthGuard` for every mutating
  request on an authenticated route.
- Global auth enforcement: `SessionAuthGuard` registered as `APP_GUARD`, so every route requires
  a session by default; `@Public()` opts a route out (used by health/ready and the
  register/login/password-reset endpoints).
- Organization-scoped authorization: `OrgRolesGuard` + `@RequireRole()` re-derive the caller's
  `OrganizationMember` row server-side for every `:organizationId` route — never trusts the
  client. Uniform `403` regardless of whether the org doesn't exist, isn't theirs, or their role
  is insufficient (no existence-leak via `404` vs `403`).
- `OrganizationsModule`: list my organizations, get one, list members, change a member's role,
  remove a member — with a guard against ever leaving an organization with zero `OWNER`s.
- Password reset flow end-to-end (request → token → confirm → all existing sessions invalidated),
  backed by a `MailerService` stub that logs instead of sending (no email provider wired up yet —
  documented as a pre-production requirement in `docs/SECURITY.md`).
- `docs/SECURITY.md` and `docs/API.md` written to document what's actually implemented.

## Key files

- `apps/api/src/auth/{auth.service,auth.controller,auth.module,password.util,session.util,mailer.service}.ts`
- `apps/api/src/auth/guards/{session-auth,org-roles}.guard.ts`
- `apps/api/src/auth/decorators/{public,current-user,require-role}.decorator.ts`
- `apps/api/src/organizations/{organizations.service,organizations.controller,organizations.module}.ts`
- `packages/shared/src/slug.ts` (organization slug generation)

## Tests added

- `apps/api/src/auth/password.util.spec.ts` (4 unit tests) — hash/verify correctness, salted
  uniqueness, malformed-input handling.
- `apps/api/test/auth.e2e-spec.ts` (6 e2e tests, real Postgres/Redis) — unauthenticated access
  rejected, register/login/duplicate-email/logout/session-invalidation, and a mutating request
  with a valid session but missing CSRF token is rejected.
- `apps/api/test/organizations.e2e-spec.ts` (7 e2e tests) — **the cross-tenant access tests the
  Phase 03 gate explicitly requires**: two independently registered users/orgs; one cannot read,
  list-members, or change-role on the other's organization; a fabricated organization ID is
  rejected the same way as a real-but-foreign one; the last `OWNER` cannot be demoted or removed.
- `apps/api/test/password-reset.e2e-spec.ts` (3 e2e tests) — no user-enumeration on request,
  full reset flow with old-session invalidation and old-password rejection, reused/invalid token
  rejection.
- `packages/ui` and `packages/shared` test counts unchanged from Phase 02 (23 + 5); grand total
  across the workspace is now 5 (api unit) + 16 (api e2e) + 23 (shared) + 5 (ui) = 49 automated
  tests, all passing.

## Commands executed and results

```
pnpm build              → 9/9 succeeded
pnpm typecheck          → 15/15 succeeded
pnpm lint               → 15/15 succeeded
pnpm test               → 15/15 succeeded (5 api unit tests + others)
pnpm test:e2e           → 10/10 succeeded (16 api e2e tests: auth, organizations, password-reset)
```
Repeated the full `build → typecheck → lint → test → test:e2e` sequence multiple times in a row
after each fix, clean, to confirm the pipeline is stable and not flaky.

## Architecture decisions

ADR-005 (session cookies over JWTs) and ADR-006 (explicit per-task env vars in Turborepo) — see
`docs/DECISIONS.md`.

## Bugs found during self-audit and fixes made

- `@typescript-eslint/no-unused-vars` didn't have `varsIgnorePattern`, so the conventional
  `const { passwordHash: _passwordHash, ...safeUser } = user` pattern (used to strip the hash
  before returning a user) failed lint. Added `varsIgnorePattern: "^_"` to the shared ESLint
  config — a one-line fix rather than renaming a defensible pattern used to sanitize sensitive
  fields.
- The e2e test harness (`test/test-app.ts`) built a `NestApplication` without the global route
  prefix or validation pipe that `main.ts` applies, so every e2e test 404'd. Extracted the shared
  setup into `apps/api/src/configure-app.ts`, used by both `main.ts` and the test harness, so
  they structurally cannot drift apart again.
- NestJS's constructor-based DI depends on TypeScript's `emitDecoratorMetadata`, which Vitest's
  default esbuild transform does not produce — every guard/service constructor param resolved to
  `undefined` at runtime under `vitest run` (e.g. `SessionAuthGuard`'s `Reflector` and
  `AuthService` were both `undefined`, throwing on the very first guarded request). Added
  `unplugin-swc` (SWC transform with `decoratorMetadata: true` in `.swcrc`, matching tsc's
  behavior) to both `vitest.config.ts` and `vitest.e2e.config.ts` — this is NestJS's own
  documented recipe for using Vitest, not a workaround specific to this repo.
- Root-level `pnpm build`/`pnpm test:e2e` intermittently failed `apps/web`'s `next build` with an
  unrelated-looking Next.js internal error. Root-caused to `NODE_ENV=development` (from a locally
  sourced `.env`, needed for `DATABASE_URL`/`REDIS_URL`) leaking through Turbo into the build
  process. Fixed per ADR-006 rather than telling developers "don't source `.env` before running
  `pnpm build`," which would have been a footgun left for the next person.
- `apps/api`'s `tsconfig.json` only covered `src/`, so `pnpm typecheck` silently never checked
  `test/*.e2e-spec.ts`, and `pnpm lint` errored outright once `test/` had real files (parser
  couldn't find them in the configured `tsconfig.json` project). Added
  `apps/api/tsconfig.eslint.json` (extends the real config, includes `test/`) and pointed both
  the lint parserOptions and the `typecheck` script at it, so test code gets the same type/lint
  coverage as production code instead of being a blind spot.

## Known limitations / technical debt

- Password reset emails are logged, not sent (`MailerService` stub) — wiring a real provider
  (SES/Postmark/etc.) is a pre-production requirement, tracked here and in
  `docs/RELEASE_CHECKLIST.md` once that file exists (Phase 20).
- Email verification (`User.emailVerifiedAt`) is stored but not yet enforced anywhere — no route
  currently requires a verified email. Revisit once email sending is real.
- No account lockout after repeated failed logins beyond the general rate limit (10 req/min on
  `/auth/login`). Acceptable for this stage; revisit in the Phase 17 security audit if it looks
  too permissive under adversarial review.
- `OrganizationsController` covers membership management but not organization creation as a
  standalone action (an org is currently only created as part of registration). Phase 04's
  onboarding flow will determine whether "create an additional organization" is actually needed
  for the initial release or is backlog material.

## Security considerations

Documented in full in `docs/SECURITY.md` (new this phase): password storage, session model, CSRF
model, rate limiting, no-enumeration guarantees, and the tenant-isolation guarantees backed by
the e2e tests above. The known gaps above are recorded, not silently accepted.

## Readiness for next phase

Gate met: cross-organization access attempts fail, verified by automated tests exercising real
HTTP requests against a real Postgres-backed API, not asserted from memory. Proceeding to Phase
04 (Projects & Onboarding).
