# Release Checklist

Status of this build as a release candidate. See `docs/FINAL_HANDOFF.md` for the full handoff
narrative; this is the scannable checklist version.

## Product

- [x] All five core questions (`docs/PRODUCT.md`) have real, live-verified features: Search
      Health (Phase 08), Forge Priorities (Phase 08), Issues/Pages (Phases 10–11), Crawl
      Comparison (Phase 13).
- [x] Crawler ≠ Audit Engine boundary maintained throughout (`docs/ARCHITECTURE.md`).
- [x] Public marketing site reflects only implemented, live-verified features (Phase 15).
- [x] No out-of-scope features built (keyword database, backlink index, PPC/CRM, generative AI
      assistant, GSC/GA integration, WordPress plugin, public API product, complex billing,
      affiliate system — see `docs/PRODUCT.md`).

## Correctness

- [x] Full workspace build/typecheck/lint clean (`pnpm build && pnpm typecheck && pnpm lint`).
- [x] 68 e2e tests passing (`pnpm test:e2e`), 17 unit/integration suites passing (`pnpm test`).
- [x] Full regression pass with a fresh live walkthrough (Phase 19) — zero regressions across all
      prior phases working together.

## Security

- [x] Dedicated adversarial audit (Phase 17) — one real finding fixed (unvalidated pagination/
      baseline query params), everything else confirmed sound. See `docs/SECURITY.md`.
- [x] Multi-tenancy re-derived server-side on every request, never trusted from the client.
- [x] No raw SQL, no committed secrets, no SQL injection surface.
- [x] SSRF protection on crawler network requests (`packages/crawler/src/ssrf.ts`).

## Performance & reliability

- [x] Dedicated audit (Phase 18) — unbounded queries capped, indexes/job retries/timeouts
      confirmed already correct. See `docs/progress/PHASE-18.md`.
- [x] Performance (Core Web Vitals) sampling is deliberately bounded — 5-page cap, independent
      low-concurrency queue (`docs/PERFORMANCE.md`).

## Accessibility & responsiveness

- [x] Every project view verified at 375×812 mobile width with no layout overflow.
- [x] Search/filter inputs carry `aria-label`s (Phase 16); form inputs use `<Label htmlFor>`.
- [x] `StatusState` gives every empty/error/denied screen a consistent, accessible shape
      (`role="alert"`/`role="status"`).

## Documentation

- [x] Every `docs/README.md` link resolves to a real file (verified as part of this checklist's
      own creation — it previously didn't, alongside `DATABASE.md`/`DEPLOYMENT.md`/
      `OPERATIONS.md`, all closed in Phase 20).
- [x] `docs/progress/PHASE-01.md` through `PHASE-20.md` — one per phase, each with scope, tests,
      live verification, bugs found/fixed, and known limitations.
- [x] `.env.example` documents every environment variable actually read by the application code
      (cross-checked in Phase 20 after finding two undocumented ones).

## Deployment readiness (prepared, not executed)

- [x] Dockerfiles exist for api/worker/web (Phase 20) — never built or pushed.
- [x] `docs/DEPLOYMENT.md` documents required env vars, migration command, and topology.
- [x] `docs/OPERATIONS.md` documents health checks, scaling knobs, logging, and incident tracing.
- [ ] **Not done, and deliberately so**: no image built, no migration run against a production
      database, no DNS/TLS configured, no production secret issued, no deploy executed. Per the
      master build constraints, this remains for whoever performs the actual deployment.

## Known, documented gaps (not blockers — see each phase doc for full rationale)

- Primary-site-only scope for every project-level view (multi-site aggregation not built).
- No PDF export for Reports (CSV + the web view cover the "shareable snapshot" need).
- No arbitrary-pair Crawl Comparison UI (API supports it via `baselineCrawlId`; only "compare to
  previous" is exposed in the frontend).
- Email verification (`User.emailVerifiedAt`) not enforced; outbound email is a dev-stub — both
  intentionally deferred until real email delivery is in scope.
