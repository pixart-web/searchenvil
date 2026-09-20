# Final Handoff — SearchAnvil Release Candidate

**Status: Release Candidate — Ready for External Audit. Never deployed.**

## What this is

SearchAnvil ("Forge Better Search Performance") is a multi-tenant SaaS platform for website
intelligence and technical SEO auditing, built end to end across 20 phases from an empty
repository to this release candidate. It answers five questions for a website owner (health,
what's wrong, what to fix first, which pages, did it improve — `docs/PRODUCT.md`) via a real,
working core loop:

```
PROJECT → WEBSITE → CRAWL → FACTS → AUDIT → SEARCH HEALTH → FORGE PRIORITIES → FIXES → RECRAWL → COMPARISON
```

Every stage of that loop is implemented, tested, and has been proven against real live data — not
just the crawl/audit backend, but the full path through to the browser: real crawls of
`https://example.com`, a real Chromium browser measuring real Core Web Vitals, real Search Health
scores rendering in the actual frontend, a real crawl-to-crawl comparison, and a real downloadable
CSV report, all confirmed via live verification at every phase (`docs/progress/PHASE-*.md`).

## What was built, by phase

| Phase | What | Doc |
|---|---|---|
| 01 | Monorepo foundation, DB schema, API/worker/web skeletons | `docs/progress/PHASE-01.md` |
| 02 | Design system and responsive application shell | `PHASE-02.md` |
| 03 | Session auth, enforced multi-tenancy | `PHASE-03.md` |
| 04 | Projects/Sites API, onboarding flow | `PHASE-04.md` |
| 05 | Crawler foundation, SSRF-safe fetching, fact extraction | `PHASE-05.md` |
| 06 | Crawl persistence, worker pipeline, cancellation | `PHASE-06.md` |
| 07 | Audit engine — 28 rules, auto worker integration | `PHASE-07.md` |
| 08 | Search Health scoring, Forge Priorities ranking | `PHASE-08.md` |
| 09 | Overview dashboard | `PHASE-09.md` |
| 10 | Issues list/detail | `PHASE-10.md` |
| 11 | Pages inventory, per-page technical profile | `PHASE-11.md` |
| 12 | Performance — real-browser Core Web Vitals sampling | `PHASE-12.md` |
| 13 | Crawl Comparison | `PHASE-13.md` |
| 14 | Reports (CSV export) | `PHASE-14.md` |
| 15 | Public marketing website | `PHASE-15.md` |
| 16 | Product Polish (fixed a real returning-user bug) | `PHASE-16.md` |
| 17 | Security Audit (fixed a real validation gap) | `PHASE-17.md` |
| 18 | Performance & Reliability Audit (capped 3 unbounded queries) | `PHASE-18.md` |
| 19 | Full Regression (fresh live walkthrough, zero regressions) | `PHASE-19.md` |
| 20 | Release Candidate Prep (Dockerfiles, closed 3 doc gaps, removed dead schema) | `PHASE-20.md` |

## Current state, verified

- **Build/typecheck/lint**: clean across all 10 packages/apps.
- **Tests**: 68 e2e tests, 17 unit/integration suites — all passing.
- **Live verification**: every major feature has been exercised end-to-end against real data at
  least once (documented per-phase), including a full fresh-user regression walkthrough in
  Phase 19 that exercised the entire product together, not just each feature in isolation.
- **Security**: adversarial audit (Phase 17) — one real finding fixed, everything else confirmed
  sound. Full detail in `docs/SECURITY.md`.
- **Git**: working tree clean, every phase its own commit, no uncommitted work.

## Self-audit findings and fixes (the honest ledger)

Real issues found and fixed during this build, not hidden:

1. **Phase 12 design catch**: PERFORMANCE-category Search Health penalties would have been
   diluted against total crawl size instead of sample size — caught before shipping, fixed with a
   per-category denominator.
2. **Phase 16**: a genuine returning-user bug — login unconditionally sent every user back through
   onboarding, risking a duplicate project on every sign-in. Fixed with a real `/app/projects`
   list page.
3. **Phase 17**: Crawl Comparison's pagination/`baselineCrawlId` query params weren't going
   through the DTO validation convention used everywhere else — fixed, test-verified.
4. **Phase 18**: three genuinely unbounded database queries — capped defensively.
5. **Phase 20**: three documentation files linked from `docs/README.md` since Phase 01 but never
   written (`DATABASE.md`, `DEPLOYMENT.md`, `OPERATIONS.md`) — closed. Two undocumented env
   variables for an already-shipped feature — closed. Two entirely unused, dead database tables
   (`Report`, `UsageRecord`) — removed via a real migration. One more missing doc found in this
   final audit (`RELEASE_CHECKLIST.md`) — closed.

## Known, deliberate limitations (not bugs)

See `docs/RELEASE_CHECKLIST.md`'s "Known, documented gaps" section and each phase doc's "Known
limitations" for full detail. In summary: primary-site-only scope per project (documented since
Phase 09), no PDF export for Reports, no arbitrary-pair Crawl Comparison UI (API supports it, only
the default path is exposed in the frontend), email verification/outbound email intentionally
deferred (out of scope for this build per the master constraints).

## What was explicitly never done

Per the master build constraints: **no production deployment**. No SSH to any host, no production
DNS/TLS, no migration run against a production database, no production secret issued or stored, no
`docker build`/push/deploy executed against a real target. Deployment *artifacts* (Dockerfiles,
`docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`) were prepared in Phase 20 for whoever performs the
actual deployment — a decision and action outside this build's authority.

## For the external auditor

Start with `docs/README.md` for the full documentation map. `docs/DECISIONS.md` has the
architecture decision records. Every phase's live-verification evidence (what was actually run,
what the output actually was) is in its own `docs/progress/PHASE-XX.md` rather than asserted here
— this document is a summary and index, not the source of truth for any specific claim.

---

# SA-RC21 — External Audit Remediation

Remediation of the 17 findings raised by the external architecture/code review, performed after
this build's initial release-candidate state above. Not a feature-development pass — every change
below fixes a specific cited finding, nothing more.

## Finding-by-finding

### #1 Brand migration SearchEnvil → SearchAnvil (P0)
- **Files changed**: repository-wide (140 tracked files) — package names (`@searchenvil/*` →
  `@searchanvil/*`), workspace/turbo references, Dockerfiles, `docker-compose.yml`, CI workflow,
  cookie names, crawler user agent, app metadata/UI copy, `.env.example`, test fixtures, all docs.
- **Implementation**: bulk case-preserving text substitution (`SearchEnvil`→`SearchAnvil`,
  `searchenvil`→`searchanvil`, `SEARCHENVIL`→`SEARCHANVIL`) across every git-tracked file, then a
  full `pnpm install` to regenerate `pnpm-lock.yaml` with the renamed package names. Local dev
  Postgres/Redis containers were recreated under the new compose project name (old
  `searchenvil-*` containers/volumes were dev-only and removed, not migrated — no production data
  existed).
- **Tests**: no new tests (a rename, not new logic) — the full existing suite re-run against the
  renamed stack to confirm nothing broke.
- **Verification**: `git grep -il "searchenvil"` returns zero hits in tracked files. All 4
  migrations re-applied cleanly to a fresh, freshly-named database. 68/68 e2e tests pass.
- **Final status**: **COMPLETE.**

### #2 Production-ready Chromium worker (P0)
- **Files changed**: `apps/worker/Dockerfile`, `apps/worker/package.json` (added `playwright-core`
  as a direct dependency), `docs/PERFORMANCE.md`, `docs/DEPLOYMENT.md`.
- **Implementation**: every stage of the worker image now builds on
  `mcr.microsoft.com/playwright:v1.63.0-noble` (pinned to the exact resolved `playwright-core`
  version), which ships Chromium and its OS dependencies pre-installed. `CHROMIUM_EXECUTABLE_PATH`
  is resolved at container start via a local (non-network) call to `playwright-core`'s own path
  API. The separate `PERFORMANCE` queue and `PERFORMANCE_WORKER_CONCURRENCY` are unchanged;
  execution stays isolated to the worker.
- **Tests**: none new (infrastructure, not application logic) — verified by a real container run
  instead.
- **Verification**: real `docker build` + real container run. Chromium launched, a genuinely new
  crawl's page navigation succeeded, performance collection executed, a real `PagePerformance` row
  was persisted (`status: "COMPLETED"`, real `ttfbMs: 88`/`lcpMs: 104`/`cls: 0`), the browser
  closed cleanly, and the worker stayed healthy processing further queued jobs. Full command/output
  record in `docs/DEPLOYMENT.md`.
- **Final status**: **COMPLETE.**

### #3 Sitemap discovery and crawling (P1)
- **Files changed**: `packages/crawler/src/crawler.ts` (rewrote `discoverSitemapUrls`, added
  sitemap-seeded traversal), `packages/crawler/src/crawler-sitemap.spec.ts` (new),
  `packages/crawler/src/fixtures/fixture-server.ts` (added mutable routes + `delayMs`),
  `docs/CRAWLER.md`.
- **Implementation**: `discoverSitemapUrls` now recursively walks `<sitemapindex>` nesting
  (bounded by `MAX_SITEMAP_INDEX_DEPTH=3`), fetches at most `MAX_SITEMAP_FILES=25` sitemap files
  total, and accepts at most `MAX_SITEMAP_URLS=5000` page URLs, all filtered to same-origin only.
  Every discovered URL is seeded into the crawl traversal at depth 0 alongside the start URL, so a
  page present only in the sitemap now actually gets crawled. Every existing safety rule still
  applies: SSRF-protected `safeFetch`, robots rules, `maxPages`, deduplication, cancellation.
- **Tests**: 9 new (`crawler-sitemap.spec.ts`) covering regular sitemap, sitemap index, nested
  indexes, an orphan page reachable only via the sitemap, a URL present in both a link and the
  sitemap, a foreign-origin sitemap entry, a malformed sitemap, excessive sitemap-index expansion,
  and `maxPages` still holding when the sitemap alone offers more candidates than the cap.
- **Verification**: all 9 pass; a pre-existing `maxPages` race (unrelated to sitemaps, but first
  exposed by sitemap seeding handing the pool many simultaneous candidates) was found and fixed
  alongside.
- **Final status**: **COMPLETE.**

### #4 Crawl cancellation propagation (P1)
- **Files changed**: `packages/crawler/src/fetcher.ts` (added `signal` to `FetchOptions`, passed
  to undici's `request()`), `packages/crawler/src/crawler.ts` (threads `signal` through every
  `safeFetch` call site), `packages/crawler/src/fetcher.spec.ts` (new abort test),
  `packages/crawler/src/crawler-sitemap.spec.ts` (new crawl-level abort test).
- **Implementation**: `AbortSignal` now reaches undici's `request()` call, so cancelling a crawl
  aborts an in-flight HTTP request immediately instead of only preventing new ones. Timeout
  behavior unaffected.
- **Tests**: 2 new — a fetcher-level test (an in-flight 2s-delayed fixture response is aborted in
  <1.5s) and a crawl-level test (same assertion through the full `runCrawl` pipeline).
- **Verification**: both pass; `Crawl.status` still correctly resolves to `CANCELLED`, never
  `FAILED`, on the existing worker-level cancellation test (unchanged, re-verified).
- **Final status**: **COMPLETE.**

### #5 Password recovery / email production readiness (P1)
- **Files changed**: `apps/api/src/auth/mail/*` (new: `mail-transport.interface.ts`,
  `console-mail-transport.ts`, `smtp-mail-transport.ts`, `mail-config.ts`, `mail-config.spec.ts`,
  `mail.tokens.ts`), `apps/api/src/auth/mailer.service.ts` (rewritten), `apps/api/src/auth/
  auth.module.ts`, `apps/api/src/auth/auth.service.ts`, `.env.example`, `docs/SECURITY.md`,
  `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`.
- **Implementation**: a `MailTransport` abstraction with two implementations —
  `ConsoleMailTransport` (default, deterministic, no network call — used whenever `SMTP_HOST` is
  unset) and `SmtpMailTransport` (real delivery via `nodemailer`, configured entirely through env
  vars, never hard-coded credentials). `readSmtpConfig()` validates configuration and throws a
  clear startup error for an incomplete production config rather than silently dropping mail.
  `MailerService` now builds real SearchAnvil-branded email content. All existing security
  properties (hashed/single-use/expiring reset tokens, enumeration-safe request, session
  invalidation on reset, rate limiting) are unchanged. Email verification enforcement was
  deliberately **not** added — documented as an explicit decision in `docs/SECURITY.md`, per the
  finding's own instruction.
- **Tests**: 7 new unit tests for `readSmtpConfig`'s validation logic.
- **Verification**: existing `password-reset.e2e-spec.ts` (3 tests, using the same
  `MailerService`-override pattern, unchanged) still passes — proves the transport swap didn't
  alter the flow's external behavior.
- **Final status**: **COMPLETE.**

### #6 Production Docker validation (P1 — release gate)
- **Files changed**: all three Dockerfiles, `apps/worker/package.json`, `apps/api/src/main.ts`,
  `docs/DEPLOYMENT.md`.
- **Implementation**: see finding #2 for the worker-specific Chromium work. Beyond that, this
  finding was pure verification-by-doing: built all three images for real and ran real containers.
- **Verification** (exact commands and full bug list in `docs/DEPLOYMENT.md`): all three images
  built successfully. **Five real, previously-undiscovered bugs were found and fixed** purely by
  running the builds/containers (not visible from reading the Dockerfiles): (1) missing
  `PNPM_HOME`/`PATH` broke `pnpm add -g turbo`; (2) a missing `prisma generate` step inside the
  Docker build context caused implicit-`any` TypeScript failures; (3) an Alpine/Debian libc
  mismatch crashed the worker's Prisma query engine at startup — fixed by unifying the worker's
  entire build on one Debian-based image; (4) `playwright-core` wasn't resolvable at the worker's
  own path under pnpm's strict `node_modules` layout — fixed by making it a direct dependency; (5)
  the API container failed to shut down gracefully (`SIGKILL` after timeout, `exitCode=137`)
  because its BullMQ queue connection was never explicitly closed — fixed with an explicit
  `SIGTERM`/`SIGINT` handler, re-verified with `exitCode=0`. API `/health`+`/ready` both pass
  live; worker processed a genuinely new crawl→audit→performance job end to end with real
  Chromium; web served `/`, `/login`, `/register` with the correct brand and a confirmed
  build-time-baked `NEXT_PUBLIC_API_URL`. All three containers stop cleanly.
- **Final status**: **COMPLETE.**

### #7 AUTH_SECRET documentation/configuration audit (P1)
- **Files changed**: `.env.example`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`.
- **Implementation**: audited every reference to `AUTH_SECRET` — zero runtime usage anywhere in
  `apps/`/`packages/`. Session tokens are high-entropy random values hashed with plain SHA-256, no
  secret/pepper involved, by design. The documentation claiming rotation would invalidate sessions
  was false. Per the finding's explicit instruction, **no cryptography was added** to make the old
  docs true — the unused variable was removed from `.env.example` and the misleading docs
  corrected to describe the real (manual, undedicated) path to a global logout.
- **Tests**: none needed — a documentation/config correction, not a behavior change.
- **Verification**: `grep -rn "AUTH_SECRET" apps/ packages/` returns zero hits after the fix.
- **Final status**: **COMPLETE.**

### #8 Reports scope clarification (P2) / #9 Crawl comparison UI scope clarification (P2)
No PDF reporting was implemented (CSV + the web report view remain the v0.1 scope, as already
documented in `docs/progress/PHASE-14.md`); no arbitrary-pair Crawl Comparison UI was built (the
API already supports `baselineCrawlId`, only the default "compare to previous" path is exposed in
the frontend, as already documented in `docs/progress/PHASE-13.md`). Both limitations are
re-stated explicitly in `docs/RELEASE_CHECKLIST.md`'s "Known, documented gaps" section per the
finding's instruction. **Final status: N/A — no implementation was in scope; documentation
confirmed accurate.**

## Validation results

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm lint` | PASS — 17/17 packages |
| `pnpm typecheck` | PASS — 17/17 packages |
| `pnpm test` | PASS — **236 tests**, 17 suites |
| `pnpm build` | PASS — 10/10 packages/apps |
| `pnpm test:e2e` | PASS — **68 tests**, 11 suites |
| Migrations (fresh dev database) | PASS — 4/4 applied |
| `docker build` — web | PASS |
| `docker build` — api | PASS |
| `docker build` — worker | PASS |
| Web container smoke test | PASS — `/`, `/login`, `/register` all 200, brand correct, `NEXT_PUBLIC_API_URL` baked correctly, clean shutdown |
| API container smoke test | PASS — `/health`, `/ready` both pass, clean shutdown (after fix) |
| Worker container smoke test | PASS — real Chromium launch, real crawl→audit→performance job completed, clean shutdown |
| SSRF regression | PASS — 11/11 (unchanged) |
| Multi-tenant authorization regression | PASS — 7/7 org-isolation tests (unchanged) |

## Remaining known limitations (genuine, not disguised features)

- Primary-site-only scope for every project-level view (pre-existing, documented since Phase 09;
  not part of this remediation's scope).
- No PDF export for Reports, no arbitrary-pair Crawl Comparison UI — explicitly out of scope per
  findings #8/#9.
- Email verification not enforced — a deliberate decision (finding #5), not a defect.
- The repository's GitHub name/URL (`pixart-web/searchenvil`) still contains the old brand — the
  one intentional remaining legacy name, per the explicit instruction not to rename the repository
  as part of this task.
- The Dockerfiles were built and smoke tested on this machine's Docker (Apple Silicon, arm64) —
  not verified on every possible target architecture/platform a real deployment might use.

## Production deployment

**No production deployment was performed.** No image was pushed to any registry, no migration was
run against a production database, no DNS/TLS was configured, no production secret was issued.
All verification in this section ran against local, disposable Docker containers and a local dev
Postgres/Redis instance.

---

SearchAnvil has not been deployed. It is ready for the external final audit.
