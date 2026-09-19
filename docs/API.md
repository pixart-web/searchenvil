# API

Base URL: `/api/v1` (health/readiness are unversioned — see `docs/DEVELOPMENT.md`). Every response
follows one of two shapes:

- Success: whatever the endpoint documents below.
- Error: `{ "error": { "code": string, "message": string, "requestId": string, "details"?:
  unknown } }` — see `apps/api/src/common/filters/http-exception.filter.ts`.

Every request gets an `x-request-id` response header (generated if the client didn't send one),
which also appears in error bodies and server logs for correlation.

## Authentication

All routes require a valid session cookie unless marked **Public**. See
[SECURITY.md](./SECURITY.md) for the session/CSRF model. Mutating requests
(POST/PUT/PATCH/DELETE) on an authenticated route additionally require the `x-csrf-token` header
to match the `searchenvil_csrf` cookie.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create a user + their first organization (as `OWNER`), starts a session |
| POST | `/auth/login` | Public | Start a session |
| POST | `/auth/logout` | Session + CSRF | Invalidate the current session |
| GET | `/auth/me` | Session | Current user |
| POST | `/auth/password-reset/request` | Public | Issue a reset token (always 202, never reveals whether the email exists) |
| POST | `/auth/password-reset/confirm` | Public | Consume a reset token, set a new password, invalidate all existing sessions |

`POST /auth/register` body: `{ email, password (min 10 chars), name, organizationName }`.
`POST /auth/login` body: `{ email, password }`. Both set `searchenvil_session` (httpOnly) and
`searchenvil_csrf` (readable) cookies on success and return `{ user }` (never `passwordHash`).

## Organizations

All routes below require a session. Routes with an `:organizationId` param additionally require
organization membership at the given role via `OrgRolesGuard` — see
[SECURITY.md](./SECURITY.md) for how that's enforced.

| Method | Path | Min role | Description |
|---|---|---|---|
| GET | `/organizations` | member (any) | Organizations the current user belongs to, with their role |
| GET | `/organizations/:organizationId` | MEMBER | Organization details |
| GET | `/organizations/:organizationId/members` | MEMBER | List members |
| PATCH | `/organizations/:organizationId/members/:memberId` | ADMIN | Change a member's role (blocked if it would leave zero `OWNER`s) |
| DELETE | `/organizations/:organizationId/members/:memberId` | ADMIN | Remove a member (same last-owner protection) |

## Projects

All routes require a session and organization membership (`OrgRolesGuard` on `:organizationId`,
same as Organizations above).

| Method | Path | Min role | Description |
|---|---|---|---|
| GET | `/organizations/:organizationId/projects` | MEMBER | List projects (with site count) |
| POST | `/organizations/:organizationId/projects` | MEMBER | Create a project `{ name }` |
| GET | `/organizations/:organizationId/projects/:projectId` | MEMBER | Project details |
| PATCH | `/organizations/:organizationId/projects/:projectId` | MEMBER | Update `{ name? }` |
| DELETE | `/organizations/:organizationId/projects/:projectId` | ADMIN | Delete a project (cascades to its sites/crawls) |

A `:projectId` that exists but belongs to a different organization than `:organizationId` in the
URL returns `404`, not `403` — the caller is authorized for *an* organization, just not one that
owns that project, so there's nothing more specific to say. See `docs/SECURITY.md`.

## Sites

Nested under a project: `/organizations/:organizationId/projects/:projectId/sites`. Same
`MEMBER`/`ADMIN` role split as Projects.

| Method | Path | Min role | Description |
|---|---|---|---|
| GET | `.../sites` | MEMBER | List a project's websites |
| POST | `.../sites` | MEMBER | Add a website `{ displayName, rootUrl }` — `rootUrl` must be `http(s)`, unique per project |
| GET | `.../sites/:siteId` | MEMBER | Site details |
| PATCH | `.../sites/:siteId` | MEMBER | Update `{ displayName?, rootUrl? }` |
| DELETE | `.../sites/:siteId` | ADMIN | Remove a website |

`rootUrl` is validated as a well-formed `http`/`https` URL at creation time but is **not**
fetched or resolved here — SSRF protection applies when the crawler actually requests it
(Phase 05), not at this metadata-only stage.

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness — always `{"status":"ok"}` if the process is up |
| GET | `/ready` | Public | Readiness — checks Postgres and Redis connectivity, `503` if either is down |

## What's not here yet

Projects, sites, crawls, issues, pages, performance, comparisons, and reports land in their
respective phases (04–14) and will be documented here as they ship — see
`docs/progress/PHASE-XX.md` for what's actually implemented at any point in time versus this
being a forward-looking spec.
