# Security

This document tracks security controls as they've been implemented across the build, and was
brought current in Phase 17 (a dedicated adversarial audit pass) after tracking incrementally
phase by phase before that.

## Authentication

- **Password storage**: `scrypt` (Node's built-in, `apps/api/src/auth/password.util.ts`) with a
  random 16-byte salt per user, timing-safe comparison on verify. No custom crypto invented —
  this is Node's standard KDF.
- **Sessions, not JWTs**: a session is a random 32-byte token (`session.util.ts`), stored
  server-side as a SHA-256 hash (`Session.tokenHash`) with an expiry (`AUTH_SESSION_TTL_DAYS`,
  default 30). The raw token lives only in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in
  production). This means a session can be revoked server-side at any time (logout deletes the
  row) — a capability JWTs don't give you without extra infrastructure.
- **CSRF**: double-submit cookie pattern. On login/register, a second **non-httpOnly**
  `searchanvil_csrf` cookie is set alongside the session cookie. Every mutating request
  (POST/PUT/PATCH/DELETE) on an authenticated route must echo that value back in an
  `x-csrf-token` header; `SessionAuthGuard` rejects the request otherwise. A cross-site form
  submission can set cookies but can't read them to populate the header, and can't set custom
  headers on a simple form post — this is the standard mitigation for cookie-based session auth.
  Login/register themselves are exempt (no session exists yet to protect); "login CSRF" is an
  accepted, low-severity risk for this release (see Phase 17 for whether it needs revisiting).
- **Rate limiting**: global throttle (120 req/min) via `ThrottlerGuard`, tightened to 10 req/min
  on `/auth/register` and `/auth/login` specifically (`@Throttle`) to slow down credential
  stuffing / enumeration.
- **No user enumeration via error messages**: login failure returns the same "Invalid email or
  password" regardless of whether the email exists.

## Multi-tenancy / authorization

- **Server-side re-derivation, always**: `OrgRolesGuard` re-reads the caller's
  `OrganizationMember` row for the `:organizationId` in the route on every request. Nothing about
  authorization is inferred from anything the client sends except the session cookie. See
  `apps/api/src/auth/guards/org-roles.guard.ts`.
- **Uniform 403 for every "not your tenant" case**: whether the organization doesn't exist, the
  caller isn't a member, or the caller's role is insufficient, the response is the same
  `403 Forbidden` — never a `404` that would let a caller distinguish "doesn't exist" from
  "exists but not yours" (which would leak organization ID existence).
- **Tested, not assumed**: `apps/api/test/organizations.e2e-spec.ts` registers two independent
  users/organizations and asserts one cannot read, list-members, or modify-role on the other's
  organization, cannot act on a fabricated organization ID, and that the last `OWNER` of an org
  can't be demoted/removed (which would strand the organization with no owner).

## Error handling

`GlobalExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`) normalizes every
error to `{ error: { code, message, requestId, details? } }`. Unhandled exceptions are logged
server-side with their stack trace but the client only ever sees a generic message — no stack
traces, file paths, or internal error details cross the API boundary.

## Cookies

| Cookie | httpOnly | Secure | SameSite | Purpose |
|---|---|---|---|---|
| `searchanvil_session` | yes | prod only | Lax | session token (opaque, hashed server-side) |
| `searchanvil_csrf` | no | prod only | Lax | double-submit CSRF token |

## Password reset

`POST /auth/password-reset/{request,confirm}` (`apps/api/src/auth/auth.service.ts`):

- The reset token is stored **hashed** (`hashSessionToken()`, the same SHA-256 scheme as session
  tokens) — a leaked `PasswordResetToken` row can't be used to reset a password.
- **Single-use and expiring**: `usedAt` is checked before honoring a token and set once it's
  consumed; `PASSWORD_RESET_TTL_MINUTES` bounds its lifetime.
- **No user enumeration**: `requestPasswordReset` returns the same `{ status: "ok" }` response
  whether or not the email exists, and is rate-limited (`@Throttle`, 5/min) same as login/register.
- **Session invalidation on reset**: a successful reset deletes every existing `Session` row for
  that user, so a stolen session can't outlive a password reset.

## Input validation

Every mutating endpoint's request body goes through a `class-validator` DTO, and the global
`ValidationPipe` (`apps/api/src/configure-app.ts`) runs with `whitelist: true` +
`forbidNonWhitelisted: true` — an unrecognized field in a request body is rejected outright, not
silently dropped or passed through. Query parameters are validated the same way wherever they
affect behavior beyond a raw filter passthrough (e.g. `ListPagesQueryDto`,
`ListCrawlPagesQueryDto`, `CompareCrawlQueryDto` — the latter two added in the Phase 17 audit
after finding pagination/`baselineCrawlId` query params were being coerced with a bare `Number()`
instead of validated, which could accept a negative, absurdly large, or non-numeric `pageSize`
into `crawlsService.listPages`).

## SQL injection

All database access goes through Prisma's typed query builder — no `$queryRaw`/`$executeRaw`
usage anywhere in `apps/api/src`, `apps/worker/src`, or `packages/*/src` (verified by a full-repo
grep as part of the Phase 17 audit), so there's no hand-built SQL for user input to inject into.

## CORS

`app.enableCors({ origin: process.env.WEB_URL ?? "http://localhost:3000", credentials: true })`
(`apps/api/src/main.ts`) — a single explicit origin, not a wildcard, with credentials enabled.
Appropriate for this deployment shape (one first-party frontend); would need revisiting only if
multiple frontend origins were ever introduced.

## HTTP security headers

`helmet()` is applied globally in `apps/api/src/main.ts`, giving every response
`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`,
`Strict-Transport-Security`, and the rest of helmet's default header set — verified directly in
Phase 12's live-verification `curl -D-` output, not just assumed from the middleware being present.

## File download endpoints

The only file-serving endpoint is the Reports CSV export (`GET
.../reports/:crawlId/export.csv`, `docs/API.md`). It accepts no user-controlled filename or file
path — the `Content-Disposition` filename is a hardcoded string, and the CSV body is generated
in-memory from already-authorized database rows, not read from disk — so there's no path-traversal
surface here.

## Outbound email (SA-RC21)

Password reset emails go through a pluggable `MailTransport` (`apps/api/src/auth/mail/`):
`ConsoleMailTransport` (the default — deterministic, no network call, used whenever `SMTP_HOST`
isn't set) or `SmtpMailTransport` (real delivery via `nodemailer`, configured entirely through
environment variables — see `.env.example` and `docs/OPERATIONS.md`). No credentials are
hard-coded; a deployment that sets `SMTP_HOST` but omits `MAIL_FROM_ADDRESS` fails loudly at
startup rather than silently dropping mail.

## What's deliberately not yet implemented (tracked, not forgotten)

- **Email verification enforcement**: the `User.emailVerifiedAt` column exists; nothing currently
  requires it before granting access. This remains an intentional, explicit decision for this
  release (SA-RC21 finding #5) — no part of the current application logic depends on a verified
  email (registration grants immediate access, same as before), and mandating verification would
  be new product scope, not a defect to fix. Revisit if a future requirement actually needs it.
- No artificial timing-equalization between the "email found" and "email not found" branches of
  password-reset request handling — low-severity given the identical response shape and existing
  rate limiting, noted here rather than silently accepted.
