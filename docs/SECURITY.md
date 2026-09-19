# Security

This document tracks security controls as they're implemented, phase by phase (a full
adversarial pass happens in Phase 17). It currently covers authentication and multi-tenancy
(Phase 03); crawler SSRF protections, IDOR coverage on project/site/crawl resources, and the
rest land as their phases do.

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
  `searchenvil_csrf` cookie is set alongside the session cookie. Every mutating request
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
| `searchenvil_session` | yes | prod only | Lax | session token (opaque, hashed server-side) |
| `searchenvil_csrf` | no | prod only | Lax | double-submit CSRF token |

## What's deliberately not yet implemented (tracked, not forgotten)

- Email verification enforcement (the `User.emailVerifiedAt` column exists; nothing currently
  requires it before granting access) — revisit once outbound email is wired up.
- Password reset flow (the `PasswordResetToken` table exists; no endpoints yet) — P1 for a
  release candidate, tracked in `docs/BACKLOG.md` if not picked up before Phase 20.
- CORS is currently a single allowed origin (`WEB_URL`); fine for this deployment shape, revisit
  if multiple frontend origins are ever needed.
