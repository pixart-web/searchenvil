# Release Checklist

Status of this build as a release candidate. See `docs/FINAL_HANDOFF.md` for the full handoff
narrative (including the dedicated **SA-RC21 — External Audit Remediation** section); this is the
scannable checklist version, using PASS / FAIL / N/A per item, not vague status descriptions.

## SA-RC21 remediation items (explicit gate — see `docs/FINAL_HANDOFF.md` for full detail)

| Item | Status |
|---|---|
| SearchAnvil branding migration (case-insensitive repo search for "searchenvil" returns zero hits outside git metadata) | **PASS** |
| Unit/integration tests | **PASS** — 236 tests, 17 suites |
| E2E tests | **PASS** — 68 tests, 11 suites |
| Migrations (applied to a real, freshly-created dev database) | **PASS** — 4/4 applied cleanly |
| Web Docker build | **PASS** — built and container smoke tested |
| API Docker build | **PASS** — built and container smoke tested |
| Worker Docker build | **PASS** — built and container smoke tested |
| Chromium smoke test (real browser launch inside the worker container) | **PASS** — real `PagePerformance` row produced |
| Crawler smoke test (crawl job executes inside the worker container) | **PASS** |
| Sitemap discovery test | **PASS** — 9/9 new sitemap scenarios |
| SSRF regression tests | **PASS** — 11/11 (unchanged, re-verified) |
| Multi-tenant authorization regression | **PASS** — 7/7 org-isolation tests (unchanged, re-verified) |
| Password-reset email transport (real, configurable SMTP path) | **PASS** — console (dev/test) + SMTP (production) |
| Health/readiness endpoints | **PASS** — verified live in the built API container |
| Graceful shutdown (all three services) | **PASS** — API required a real fix (see finding #6); worker and web were already correct |
| No committed secrets | **PASS** — `.env` gitignored, `.env.example` contains only placeholders |
| Documentation accuracy | **PASS** — stale claims found and corrected (AUTH_SECRET, mailer dev-stub note, three missing files) |

## Product

- [x] All five core questions (`docs/PRODUCT.md`) have real, live-verified features: Search
      Health (Phase 08), Forge Priorities (Phase 08), Issues/Pages (Phases 10–11), Crawl
      Comparison (Phase 13).
- [x] Crawler ≠ Audit Engine boundary maintained throughout (`docs/ARCHITECTURE.md`).
- [x] Public marketing site reflects only implemented, live-verified features (Phase 15).
- [x] No out-of-scope features built (keyword database, backlink index, PPC/CRM, generative AI
      assistant, GSC/GA integration, WordPress plugin, public API product, complex billing,
      affiliate system, PDF reports — see `docs/PRODUCT.md` and SA-RC21's explicit constraints).

## Correctness

- [x] Full workspace build/typecheck/lint clean (`pnpm build && pnpm typecheck && pnpm lint`).
- [x] 68 e2e tests passing (`pnpm test:e2e`), 236 unit/integration tests across 17 suites passing
      (`pnpm test`).
- [x] Full regression pass with a fresh live walkthrough (Phase 19) — zero regressions across all
      prior phases working together.

## Security

- [x] Dedicated adversarial audit (Phase 17, re-verified in SA-RC21) — sessions/passwords/reset
      tokens all hashed correctly, no raw SQL, no committed secrets. See `docs/SECURITY.md`.
- [x] Multi-tenancy re-derived server-side on every request, never trusted from the client.
- [x] SSRF protection on crawler network requests, including sitemap-discovered URLs (same-origin
      filtering + the same SSRF-checked fetch path as any other crawl target — SA-RC21 finding
      #3; `packages/crawler/src/ssrf.ts`).
- [x] Cookies renamed to `searchanvil_session`/`searchanvil_csrf`, all properties (httpOnly,
      Secure in production, SameSite=Lax) unchanged and re-verified.
- [x] `AUTH_SECRET` removed — it had no runtime purpose (SA-RC21 finding #7); the documentation
      that claimed otherwise was corrected, not the code changed to match false documentation.

## Performance & reliability

- [x] Dedicated audit (Phase 18) — unbounded queries capped, indexes/job retries/timeouts
      confirmed already correct. See `docs/progress/PHASE-18.md`.
- [x] Performance (Core Web Vitals) sampling is deliberately bounded — 5-page cap, independent
      low-concurrency queue (`docs/PERFORMANCE.md`).
- [x] Production worker image provisions Chromium automatically, no manual setup (SA-RC21 finding
      #2).
- [x] Crawl cancellation now aborts an in-flight HTTP request immediately, not just future ones
      (SA-RC21 finding #4).

## Accessibility & responsiveness

- [x] Every project view verified at 375×812 mobile width with no layout overflow.
- [x] Search/filter inputs carry `aria-label`s (Phase 16); form inputs use `<Label htmlFor>`.
- [x] `StatusState` gives every empty/error/denied screen a consistent, accessible shape
      (`role="alert"`/`role="status"`).

## Documentation

- [x] Every `docs/README.md` link resolves to a real file.
- [x] `docs/progress/PHASE-01.md` through `PHASE-20.md` — one per phase, each with scope, tests,
      live verification, bugs found/fixed, and known limitations.
- [x] `.env.example` documents every environment variable actually read by the application code,
      including the new SMTP and (removed) `AUTH_SECRET` corrections from SA-RC21.

## Deployment readiness (prepared, not executed)

- [x] Dockerfiles for api/worker/web — **actually built and container smoke tested** in SA-RC21
      (previously only written, never built — that gap is what SA-RC21 finding #6 closed).
- [x] `docs/DEPLOYMENT.md` documents required env vars, migration command, topology, and the full
      Docker verification record (exact commands, exact bugs found and fixed).
- [x] `docs/OPERATIONS.md` documents health checks, scaling knobs, logging, outbound email, and
      incident tracing.
- [ ] **Not done, and deliberately so**: no image pushed to a registry, no migration run against a
      production database, no DNS/TLS configured, no production secret issued, no deploy executed.
      Per the master build constraints (and SA-RC21's explicit instruction), this remains for
      whoever performs the actual deployment.

## Known, documented gaps (not blockers — see each phase doc / `docs/FINAL_HANDOFF.md` for full rationale)

- Primary-site-only scope for every project-level view (multi-site aggregation not built).
- No PDF export for Reports (CSV + the web view cover the "shareable snapshot" need) — explicitly
  out of scope for SA-RC21 per finding #8.
- No arbitrary-pair Crawl Comparison UI (API supports it via `baselineCrawlId`; only "compare to
  previous" is exposed in the frontend) — explicitly out of scope for SA-RC21 per finding #9.
- Email verification (`User.emailVerifiedAt`) not enforced — a deliberate decision, documented in
  `docs/SECURITY.md`, not a defect (SA-RC21 finding #5).
- The repository's GitHub name/URL (`pixart-web/searchenvil`) still contains the old brand — the
  one intentional remaining legacy name, per SA-RC21's explicit instruction not to rename the
  repository as part of this task (that's an external GitHub operation).
