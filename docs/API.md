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

## Crawls

Nested under a site: `/organizations/:organizationId/projects/:projectId/sites/:siteId/crawls`.
`MEMBER` for everything below.

| Method | Path | Description |
|---|---|---|
| POST | `.../crawls` | Start a crawl `{ maxPages? (1-1000), maxDepth? (1-20) }` — creates a `PENDING` `Crawl` row and enqueues a BullMQ job; the worker (Phase 06) picks it up asynchronously |
| GET | `.../crawls` | List crawls for a site, newest first |
| GET | `.../crawls/:crawlId` | Crawl status/progress (`status`, `pagesCrawled`, timestamps, `errorMessage`) |
| PATCH | `.../crawls/:crawlId/cancel` | Request cancellation — idempotent; a no-op if the crawl is already in a terminal state |
| GET | `.../crawls/:crawlId/pages` | Paginated (`?page=&pageSize=`, max 100/page) list of crawled pages |
| GET | `.../crawls/:crawlId/pages/:pageId` | A single page's full facts plus its images, structured data, and outbound links |
| GET | `.../crawls/:crawlId/score` | The crawl's Search Health `AuditScore` (`404` until the audit run finishes — see `docs/SCORING.md`) |
| GET | `.../crawls/:crawlId/issues` | Forge Priorities — every `AuditIssue` for the crawl, ranked by `priorityScore` descending (`[]` before the audit run finishes) |
| GET | `.../crawls/:crawlId/issues/:issueId` | One issue's full detail: rule info, evidence, and every affected page (`AuditOccurrence`) |

`Crawl.status` progresses `PENDING → DISCOVERING → CRAWLING → COMPLETED`, or `FAILED` /
`CANCELLED`. See `docs/CRAWLER.md` and `docs/ARCHITECTURE.md` for what happens at each stage. The
moment a crawl reaches `COMPLETED`, an audit run is triggered automatically — poll `GET
.../crawls/:crawlId/score` (or `/issues`) afterward; a `404`/`[]` just means the audit hasn't
finished yet, not that anything went wrong.
Cancellation is polled by the worker (checked every ~2s against the DB), so there can be a short
delay between requesting cancellation and the crawl actually stopping — in-flight page fetches
are allowed to finish, only new ones are prevented from starting.

## Project-level Issues

`/organizations/:organizationId/projects/:projectId/issues` — issues for the project's primary
site's latest **completed** audit run (same one-primary-site scope as `/overview`; see
`docs/progress/PHASE-09.md`).

| Method | Path | Description |
|---|---|---|
| GET | `.../issues` | List issues, ranked by `priorityScore` desc by default. Query: `severity` (comma-separated, e.g. `CRITICAL,HIGH`), `category` (comma-separated), `search` (case-insensitive title/summary substring), `sortBy` (`priority` \| `severity` \| `affectedPages`), `sortOrder` (`asc` \| `desc`) |
| GET | `.../issues/:issueId` | One issue's full detail: rule (what/why/how-to-fix), and every affected page with its evidence |

Returns `[]` (not an error) when no audit run has completed yet — mirrors `GET
.../crawls/:crawlId/issues`' behavior on the crawl-scoped route this project-level one is built on
top of.

## Project-level Pages

`/organizations/:organizationId/projects/:projectId/pages` — pages from the project's primary
site's latest **completed crawl** (facts exist as soon as the crawl finishes, unlike Issues which
needs the audit run too).

| Method | Path | Description |
|---|---|---|
| GET | `.../pages` | Paginated (`page`, `pageSize`, max 100) list. Query: `search` (URL substring), `indexableOnly` (`true`/`false`), `statusClass` (`2xx`\|`3xx`\|`4xx`\|`5xx`) |
| GET | `.../pages/:pageId` | Full technical profile: HTTP facts, indexability, metadata, headings, content, images, structured data, outbound links, inbound-link count (within this crawl), and every issue affecting this specific page |

## Project-level Performance

`/organizations/:organizationId/projects/:projectId/performance` — sampled Core Web Vitals for the
project's primary site's latest **completed crawl**. See `docs/PERFORMANCE.md` for why this is a
small sample, not one row per crawled page.

| Method | Path | Description |
|---|---|---|
| GET | `.../performance` | `{ crawlId, totalPagesCrawled, samples[] }` — `totalPagesCrawled` is the real crawl size (for "N of M pages sampled" context); `samples` only ever contains the pages that were actually sampled (`PagePerformance` rows), each with `status`, `ttfbMs`/`domContentLoadedMs`/`loadTimeMs`/`lcpMs`/`cls`, `errorMessage` (set only when `status` is `FAILED`), and the sampled page's `id`/`normalizedUrl`/`title` |

Returns `{ crawlId: null, totalPagesCrawled: 0, samples: [] }` (not an error) when no crawl has
completed yet — same empty-state convention as Issues/Pages above.

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness — always `{"status":"ok"}` if the process is up |
| GET | `/ready` | Public | Readiness — checks Postgres and Redis connectivity, `503` if either is down |

## What's not here yet

Comparisons and reports land in their respective phases (13–14) and will be documented here as they
ship — see `docs/progress/PHASE-XX.md` for what's actually implemented at any point in time versus this
being a forward-looking spec.
