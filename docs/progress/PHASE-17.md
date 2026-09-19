# Phase 17 — Security Audit

**Status: COMPLETE — gate passed.**

## Scope implemented

A dedicated adversarial security review of the API, using an Explore agent for a broad,
independent pass across seven categories (raw SQL, secrets/path-traversal, DTO input validation,
CSRF exemptions, password reset token handling, CORS, committed secrets), followed by fixing the
one real finding and bringing `docs/SECURITY.md` fully current — it had drifted stale, still
describing password reset as "no endpoints yet" when it had been fully implemented since an
earlier phase.

**Finding fixed**: `apps/api/src/crawls/crawls.controller.ts`'s `listPages` (`page`/`pageSize`) and
`compare` (`baselineCrawlId`) query parameters were being coerced with a bare `Number()` /
passed through as a raw string, instead of going through a validated DTO like every other
query-accepting endpoint in the codebase (`ListPagesQueryDto`, `ListIssuesQueryDto`, etc.). This
meant `pageSize` could be given a negative, `NaN`, or absurdly large value, and `baselineCrawlId`
could be any string at all (not necessarily a real UUID) before reaching `CrawlsService`. Not an
injection risk (everything flows into Prisma's typed API either way), but a real inconsistency
against the established input-validation convention, and a real robustness gap (an absurd
`pageSize` could cause unexpected pagination behavior or unnecessary query cost). Fixed by adding
`ListCrawlPagesQueryDto` (`@IsInt`/`@Min`/`@Max` on `page`/`pageSize`, matching `ListPagesQueryDto`
exactly) and `CompareCrawlQueryDto` (`@IsUUID` on `baselineCrawlId`), and switching both endpoints
from individual `@Query("x")` params to `@Query() query: SomeDto`.

**Findings verified clean, no change needed** (see `docs/SECURITY.md` for the documented detail
on each): no raw SQL anywhere in the codebase; no hardcoded secrets in committed source, and the
repo-root `.env` is byte-for-byte identical to `.env.example` (no real secret ever got committed);
every DTO already carries `class-validator` decorators; the `@Public()`/CSRF-exempt route list is
exactly the four pre-authentication endpoints (register, login, password-reset request/confirm)
and nothing broader; the password reset token is hashed, single-use, expiring, enumeration-safe,
and invalidates all sessions on use; CORS is a single explicit origin with credentials, not a
wildcard; the Reports CSV export has no path-traversal surface (hardcoded filename, in-memory
generation from already-authorized rows, no disk reads).

## Key files

- `apps/api/src/crawls/dto/{list-crawl-pages-query,compare-crawl-query}.dto.ts` (new)
- `apps/api/src/crawls/crawls.controller.ts` (switched to the new DTOs)
- `apps/api/test/{crawls,crawl-comparison}.e2e-spec.ts` (new validation-rejection tests)
- `docs/SECURITY.md` (substantially rewritten — corrected the stale password-reset note, added
  documented sections for input validation, SQL injection, CORS, HTTP headers, and file downloads
  that previously existed only as scattered phase-by-phase notes or not at all)

## Tests added

- `apps/api/test/crawls.e2e-spec.ts`: "rejects out-of-range or malformed pagination query params"
  — asserts `400` for `page=-1`, `pageSize=99999`, and `page=not-a-number`, proving the DTO
  actually rejects bad input end-to-end, not just that it compiles.
- `apps/api/test/crawl-comparison.e2e-spec.ts`: "rejects a malformed baselineCrawlId instead of
  passing it through to the database" — asserts `400` for a non-UUID `baselineCrawlId`.
- Workspace total: 68 e2e (up from 66).

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10. `pnpm typecheck`: 17/17. `pnpm lint`: 17/17. `pnpm test`: 17/17. `pnpm
test:e2e`: 11/11, 68 e2e tests total.

## Manual verification

This phase's verification is the e2e tests themselves — they exercise the real HTTP layer
(`supertest` against a real NestJS app instance with the real global `ValidationPipe`), so a `400`
response in the test genuinely proves the validation pipe rejects the request, not just that a
decorator is present in source. No separate live-browser verification was needed since this phase
touches only server-side input handling, not anything user-visible or frontend-rendered.

## Architecture decisions

**No new security infrastructure — this phase found and fixed a real but narrow inconsistency
rather than needing to build anything new.** The existing controls (session/CSRF, `OrgRolesGuard`,
`class-validator` DTOs, `helmet()`, rate limiting) were already sound; the audit's job was to
verify that claim rather than assume it, and the one finding was a spot where a newer endpoint
(Crawl Comparison, Phase 13) hadn't been brought into line with the DTO-validation convention
established since Phase 04. Fixed by conforming to the existing pattern, not inventing a new one.

## Bugs found during self-audit and fixes made

- The `pageSize`/`page`/`baselineCrawlId` unvalidated-query-param gap described above — fixed.
- `docs/SECURITY.md` itself was stale (claimed password reset had "no endpoints yet") — corrected,
  and substantially expanded with sections that previously didn't exist (input validation, SQL
  injection posture, CORS, HTTP headers, file download safety) so the document is now a genuinely
  complete reference rather than a phase-by-phase changelog.
- No other issues found across the seven audited categories.

## Known limitations / technical debt

- No artificial timing-equalization on password-reset-request's found/not-found branches — noted
  explicitly in `docs/SECURITY.md` as an accepted low-severity gap (identical response shape +
  rate limiting already mitigate the practical risk), not silently ignored.
- Email verification (`User.emailVerifiedAt`) still isn't enforced anywhere — unchanged from
  before this phase, tracked as intentionally deferred until real outbound email exists (which
  itself is out of scope for this build per the master constraints).

## Security considerations

This phase *is* the security considerations section for once — see `docs/SECURITY.md` in full for
the current, accurate state of every control.

## Readiness for next phase

Gate met: a dedicated adversarial pass across authentication, authorization, input validation,
injection risk, CORS, and secret handling found one real, fixed, test-verified gap and confirmed
everything else already sound — not a rubber-stamp "looks fine" pass. `docs/SECURITY.md` is now
accurate and complete rather than a stale phase-by-phase log. Proceeding to Phase 18 (Performance &
Reliability Audit).
