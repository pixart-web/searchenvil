# Marketing Site

The public marketing website lives inside `apps/web`, alongside the real product (`/app/*`,
`/login`, `/register`, `/onboarding`). Marketing pages are grouped under the Next.js route group
`apps/web/src/app/(marketing)/` (a folder in parentheses — it does not appear in the URL), so they
share one nav/footer layout without touching product routes.

## Visual redesign (2026-09)

The original text-and-card marketing pass was rejected by the product owner as generic and
lacking real product imagery. This section documents the redesign that replaced it — the rest of
this doc (routes, claims, lead capture, commercial state) still applies unchanged.

### Brand system

- **Palette** (`packages/ui/src/tokens/colors.ts`, mirrored in `apps/web/tailwind.config.ts`):
  obsidian/graphite (`forge-950/900/800`), warm ivory text (`steel-100`), copper-orange accent
  (`ember-500`, with `ember-700` as an AA-contrast variant for accent text on light backgrounds),
  and a new warm-ivory **paper** section (`paper` / `paper-raised` / `paper-line`) with matching
  dark **ink** text (`ink` / `ink-muted`) for the Priorities scene's light break. `violet-500` and
  the `success`/`warning`/`danger` semantic tokens are unchanged (still used by
  `SearchHealthGauge`/`Badge severity`).
- **Type**: one display face (**Newsreader**, `--font-display`, headlines and the wordmark — see
  "Reference-mockup alignment pass" below for why it replaced Space Grotesk), one body face (Inter,
  `--font-body`), one mono face used sparingly for technical labels (JetBrains Mono,
  `--font-mono`) — all loaded via `next/font/google` in `apps/web/src/app/layout.tsx`. The
  previous `--font-geist-sans`/`--font-geist-mono` variables referenced a font family ("Geist")
  that was never actually loaded anywhere in the repo (no `next/font` call, no `@font-face`, no
  stylesheet link) and silently fell back to `system-ui` — this redesign is the first time the
  site actually ships real, self-hosted type.
- **Logo system** (`apps/web/src/components/marketing/Logo.tsx`): a simplified rounded-square
  copper badge (`AnvilMark` — a flat anvil silhouette on a solid `ember-500` square, matching the
  approved reference mockup's compact header icon; it replaced an earlier outlined mark with a
  four-corner "inspection reticle"), a `Wordmark` (display-face type, no spaced-letter tracking, a
  single ivory color all the way through — the reference does not two-tone "Anvil"), and a
  `Lockup` combining both, used in `MarketingNav`/`MarketingFooter`. `apps/web/src/app/icon.tsx`
  (favicon) and `apps/web/src/app/opengraph-image.tsx` (default OG image) are generated from the
  same shapes via Next's `ImageResponse`/Satori, so the mark is defined once as code rather than
  as a shipped raster asset (Satori can't import the client `Logo.tsx` component directly, so the
  path data is duplicated in `icon.tsx`/`opengraph-image.tsx` — keep them in sync if the mark
  changes).

### Motion (GSAP)

`gsap` (`^3.12.7`, including the now-free `ScrollTrigger` plugin) was added to
`apps/web/package.json` — the first animation dependency in the repo. `apps/web/src/lib/gsap.ts`
registers `ScrollTrigger` once (`ensureGsap()`); `apps/web/src/lib/motion.ts` exports
`usePrefersReducedMotion()` and `useIsMobile()`, used by every animated component. Every
scroll-linked composition lives under `apps/web/src/components/marketing/art/` and follows the
same pattern: a `useLayoutEffect` creates a `gsap.context(...)` scoped to the section, and
`ctx.revert()` on cleanup tears down its ScrollTriggers — this is what keeps re-navigating to `/`
(or resizing) from accumulating dead triggers. Components check `usePrefersReducedMotion()` first
and return fully static JSX (no refs, no pin, no `ScrollTrigger.create`) when it's true.

### Homepage: six scenes

`apps/web/src/app/(marketing)/page.tsx` is now a thin server component that only owns
`metadata`/OG/canonical (a `"use client"` file can't export `metadata`); the actual scene markup
lives in the client component `apps/web/src/app/(marketing)/HomeClient.tsx`.

| Scene | Component | Scroll behavior |
|---|---|---|
| 1. Hero | `art/HeroComposition.tsx` | Desktop: pinned ~90% extra scroll — hero copy fades/exits while a tilted browser/crawl panel straightens and scales up, with a moving scanline. Mobile: pin skipped, short fade/scale-in on enter instead. |
| 2. Website Anatomy | `art/WebsiteAnatomy.tsx` | Desktop: pinned ~140% extra scroll — six page cards settle into position, SVG connection lines draw between them, then one affected page (a legacy page with a 404) scales up and the rest fade. Mobile: same sequence, un-pinned, scrubbed against normal scroll. |
| 3. Product Walkthrough | `art/ProductStage.tsx` | Desktop: pinned ~300% extra scroll, four chapters (Overview/Issues/Affected pages/Reports) crossfade as you scroll; the eyebrow buttons above the stage are real `<button role="tab">`s that jump directly to a chapter (`window.scrollTo`) — the accessible, non-linear way through the same content. Mobile (and reduced motion): the same four chapters render as a static stacked list instead of a long pin. |
| 4. Priorities | `art/PriorityDetail.tsx` | The warm-ivory "paper" break. Desktop: pinned ~120% extra scroll — a ranked issue list highlights one row, an issue-detail card fades in, then its affected pages reveal. Mobile: un-pinned, same scrub sequence. |
| 5. Progress/Reporting | `art/ComparisonReveal.tsx` | A clip-path wipe (scroll-scrubbed) reveals an "after" crawl's Search Health/issue counts over a "before" one, built on the real `SearchHealthGauge` primitive. A `<input type="range">` next to it is the always-available, non-scroll control (labelled, keyboard-operable) — not decoration; it's the primary path for anyone not scroll-scrubbing. |
| 6. Pricing/Closing | `art/ClosingArt.tsx` | Static, deliberately quiet — a settled echo of the hero's layered-page composition. This scene's job is the price and the CTA, not another sequence. |

That's five independently working scroll-linked sequences (well above the "at least three"
requirement), plus the audience/FAQ/closing sections retained from the previous pass (consolidated
from the old 9-scene layout, verified-feature scenes only — no invented capability got a scene).

### Supporting pages

`/platform`, `/pricing`, and the three `/solutions/*` pages now render a real above-the-fold visual
(`art/SupportingVisual.tsx` — the same layered-panel + anvil-mark language as the homepage,
distinguished per page by a small role icon) next to their heading, via `SolutionPage.tsx`'s new
`Icon` prop, instead of the old centered-text-only hero. Their body content (capability/point
grids) was kept — that pattern earns its place as a content grid, not a "generic card wall".

### Copy

Implementation/defensive jargon was removed from customer-facing copy (`site-config.ts`
`CLAIMS`/`FAQ_ITEMS`, page metadata, and body copy): "SSRF-safe" → "respects robots.txt and your
sitemap"; "Chromium-based" → "real-browser"; "versioned Search Health score" → "a Search Health
score that stays explainable over time" / "keeps a full explanation attached"; "deterministic audit
engine" → "the same site always produces the same result"; "fair-use crawl concurrency limits" →
"subject to fair use". The claim registry in `site-config.ts` (`CLAIMS`) is not itself rendered
anywhere (it's an internal claim-to-source trace used when writing new copy), but was softened too
since future copy is meant to paraphrase from it.

### Accessibility / reduced motion

Every `art/*` component has a complete static fallback under `usePrefersReducedMotion()` — verified
by code review; this environment's browser tooling doesn't expose `prefers-reduced-motion`
emulation, so it wasn't verified via a live OS-level toggle (same caveat as the previous pass, see
"Known limitations"). `globals.css` also sets a CSS-level `prefers-reduced-motion` floor
(near-zero animation/transition duration) for anything outside the GSAP-driven components.
`ProductStage`'s chapter tabs are real, keyboard-reachable `<button role="tab">`s; the comparison
scene's slider is a labelled native `<input type="range">`. `html, body { overflow-x: hidden }` in
`globals.css` plus `clamp()`-bounded card positions in `WebsiteAnatomy` prevent scroll-linked
compositions from introducing horizontal overflow on narrow viewports.

## Reference-mockup alignment pass (2026-10)

The product owner approved a specific visual reference mockup (hero + pricing scenes) and asked
the live site to be brought in line with it closely, after the September pass above was judged
"insufficiently visual." This section documents what changed and why.

### Font

Display face changed from Space Grotesk (geometric sans) to **Newsreader**, a free Google Serif
family. The reference headline ("Find what's holding your website back.") is set in a classic
transitional serif — moderate stroke contrast, bracketed serifs, a plain curly apostrophe —
closer to an editorial/book face than a display-quirky one. Three candidates were compared against
the reference's letterforms: **Fraunces** was ruled out (its "soft"/wonky optical-size terminals
read as more playful/organic than the reference), **Libre Caslon Text** was ruled out (narrower,
more old-style lowercase than the reference's even, rounded letterforms), and **Newsreader** was
the closest match — it's purpose-built to resemble a classic book/editorial serif at display
sizes. Loaded at weights 500/600 only (no italics, no extra weights) to keep the font payload
small. Body (Inter) and mono (JetBrains Mono) are unchanged.

### Logo

`AnvilMark` changed from an outlined anvil-profile-plus-reticle mark to a simplified flat anvil
silhouette on a solid copper (`ember-500`) rounded-square badge, matching the reference header's
compact icon. `Wordmark` changed from two-tone ("Search" ivory + "Anvil" copper) to a single ivory
color throughout — re-verified directly against the reference image, which does not split the
wordmark's color. Re-checked at favicon size (`apps/web/src/app/icon.tsx`, 32px) and in the OG
image (`apps/web/src/app/opengraph-image.tsx`); both were updated to the same geometry.

### Scenes rebuilt

- **Hero** (`art/HeroComposition.tsx`): rebuilt to the reference's layout — a left-aligned serif
  headline at ~35–40% width (unchanged container, `lg:max-w-[40%]`, in `HomeClient.tsx`) beside a
  3D-fanned stack of translucent dashboard panels (`perspective`/`rotateY`/`translateZ`,
  desktop-only — flattened on mobile, see "Mobile" below), connected by thin copper SVG lines,
  above a dark rocky ground with a copper glow. The front panel is a readable "Overview" dashboard
  (Search Health ring, issue count + sparkline, indexed pages, avg page speed, issue-category
  donut) using the same field names as the real project-overview DTO
  (`overallScore`/`issuesByCategory` etc. — see `apps/web/src/app/app/projects/[projectId]/page.tsx`)
  plus the extra metrics (indexed pages, avg page speed, issues-over-time) the reference shows but
  the real API doesn't expose yet. Labeled "Illustrative data" per the existing convention.
- **Scene 2 / Overview chapter** (`art/ProductStage.tsx`, the "01 — Overview" chapter panel):
  rebuilt as a large flat browser-chrome-framed dashboard with an icon-rail sidebar
  (Overview/Issues/Pages/Compare), four stat tiles, an "Issues over time" multi-series area chart,
  and a "Top issue types" table — matching the reference's "Your website. A clearer picture."
  panel. Also labeled "Illustrative data".
- **Priorities scene** (`art/PriorityDetail.tsx`, the warm-ivory "paper" break): the issue-detail
  card was extended to match the reference's layout — severity badge, affected-pages count with a
  trend delta, a "potential impact" mini bar chart, category + first/last-seen metadata, a tab row
  ("Affected pages" / "Why it matters" / "How to fix"), and an affected-pages table with a
  status badge and page type per row.
- **Closing/pricing scene** (`art/ClosingArt.tsx` + the pricing block in `HomeClient.tsx`): price
  block rebuilt to the reference's plain stacked layout (no bordered card) — "Expected launch
  price" / large "€79.99 / month" / "Join the launch list →" button, left-aligned next to the art.
- **Nav/CTAs**: "Join the launch list" and "Explore the platform" buttons now carry a trailing
  arrow (`→`), matching the reference. The hero's "Prelaunch" eyebrow badge was removed so the H1
  leads directly, also matching the reference (its message — prelaunch framing — is still carried
  by the `PRICING.framing` mono line directly under the CTAs).

**Copy decision**: the reference mockup's exact headlines for scenes 2 and 3 ("Your website. A
clearer picture." / "Turn findings into focused work.") were **not** adopted verbatim. The existing
site-config-driven headlines ("Every page, mapped and connected" / "Know what deserves attention
first") were kept, because the brief for this pass was explicitly about visual/layout fidelity
("insufficiently visual," not "wrong copy"), and rewriting established, previously-reviewed
marketing copy was out of scope for a visual-alignment pass. The pricing/closing scene's headline
*was* adopted verbatim ("Make your next website decision clearer.") since the reference's
"Expected launch price" / "€79.99 / month" framing already matched `site-config.ts`'s `PRICING`
object exactly, making that scene's text a description of the same approved content rather than a
rewrite.

### Stylized approximations — not photographic matches

No photorealistic image-generation tool is available in this environment, so the reference's
painterly "anvil on rock, copper glow / lens-flare" background art could not be reproduced exactly.
Two specific spots are CSS/SVG approximations instead, both called out in code comments where they
live:

1. **Hero backdrop** (`art/HeroComposition.tsx`, the `.hero-ground`/`.hero-glow` elements): a
   radial-gradient copper glow plus a two-layer SVG polygon "rock" silhouette.
2. **Closing-scene echo art** (`art/ClosingArt.tsx`): the same glow/rock technique at smaller
   scale, with a flat anvil glyph standing on the rock catching the glow (`drop-shadow`).

Both are built as code (gradients/SVG), not a baked raster placeholder, and are stylized rather
than photographic — distant in fidelity from the reference's painterly rendering, but directionally
matching its composition (glow below-center, dark jagged ground, warm light rising).

### Real screenshots vs. illustrative data

Real screenshots of the running app were investigated and **not used** for any dashboard panel,
for two independent reasons found before building anything:

1. `packages/database/prisma/seed.ts`'s demo seed (`demo@searchanvil.com`) creates a user,
   organization, project, and site — but no crawl and no issues. Every real dashboard route under
   `/app/projects/[projectId]/...` would render its empty state (`NoCrawlsYet` /
   `StatusState kind="empty"`) against that seed, not the rich data the reference shows.
2. The reference mockup's dashboard panels show metrics — indexed pages, avg page speed, an
   "Issues over time" trend chart, a "Top issue types" table — that don't exist in the real
   project-overview API yet (`apps/api`'s overview DTO exposes `overallScore`, `categoryScores`,
   `topIssues`, `issuesByCategory`, and `recentCrawls`; no indexed-page count, no page-speed
   metric, no time-series). Even a fully seeded real screenshot would not match the reference's
   panels, because that UI doesn't fully exist in the product yet.

Given both, every dashboard panel in the hero, Scene-2 overview, and priorities issue-detail card
is built from the real `@searchanvil/ui` primitives (`Card`, `Badge`, `SearchHealthGauge`) and the
real DTO field names/route structure that *do* exist, filled with illustrative numbers (reusing
the same plausible figures as the approved reference — 78 health score, 142 issues, 8,421 indexed
pages, 1.9s avg page speed — rather than inventing new ones), and labeled "Illustrative data",
consistent with the convention already established in the September pass. Docker and a local
Postgres/Redis stack (`docker-compose.yml`) are available in this environment, so bringing up the
real stack was not the blocker; the demo seed's lack of crawl/issue data and the gap between the
reference's metrics and the real API were.

### Mobile (390px)

`HeroComposition`'s 3D fan (perspective/rotateY/translateZ on the back panels and stage) is
desktop-only (`!reducedMotion && !isMobile`); mobile renders the front Overview panel flat with a
simple fade/slide-in, matching the existing "shorter sequences replace long desktop pins" mobile
rule used elsewhere in this file. Verified in the Browser pane at 375×812: no horizontal overflow,
logo/nav/headline/CTAs read cleanly, hero and pricing/closing artwork are both present (not
dropped) and non-overflowing.

## Routes

| Path | File | Purpose |
|---|---|---|
| `/` | `(marketing)/page.tsx` + `HomeClient.tsx` | Six-scene homepage (see "Homepage: six scenes" above), plus audience/FAQ/closing sections |
| `/platform` | `(marketing)/platform/page.tsx` | Full capability list, with a `SupportingVisual` hero |
| `/solutions/seo-professionals` | `(marketing)/solutions/seo-professionals/page.tsx` | Role-based page |
| `/solutions/agencies` | `(marketing)/solutions/agencies/page.tsx` | Role-based page |
| `/solutions/in-house-teams` | `(marketing)/solutions/in-house-teams/page.tsx` | Role-based page |
| `/pricing` | `(marketing)/pricing/page.tsx` | Prelaunch pricing, €79.99/month framed as "Expected launch price" |
| `/launch-list` | `(marketing)/launch-list/page.tsx` | Full lead-capture form |
| `/privacy`, `/terms` | `(marketing)/privacy`, `(marketing)/terms` | Draft legal pages (see "Known limitations") |
| `/sitemap.xml`, `/robots.txt` | `app/sitemap.ts`, `app/robots.ts` | Generated SEO infra |
| `/icon`, `/opengraph-image` | `app/icon.tsx`, `app/opengraph-image.tsx` | Generated favicon/OG image, built from the logo mark |

Untouched: `/login`, `/register`, `/onboarding`, `/app/*`, `/dev/*`. `/dev/*` is disallowed in
`robots.ts` and never linked from marketing nav/footer. These routes render with the refreshed
color tokens automatically (same `forge-*`/`steel-*`/`ember-*` Tailwind classes, new hex values)
but were not otherwise touched.

No Resources/blog section was added — the brief made it optional and two "real educational
articles" would either be thin placeholder content or claims not traceable to the codebase, which
conflicts with the anti-fabrication constraint. Skipped rather than faked.

## How to run/preview locally

```bash
cp .env.example .env                          # if you haven't already
docker-compose up -d                          # Postgres :5433, Redis :6380
pnpm install
pnpm db:migrate                                # applies the LaunchListSignup migration
pnpm --filter @searchanvil/api run dev         # API on :4000
pnpm --filter @searchanvil/web run dev         # marketing site + product on :3000
```

Visit `http://localhost:3000/`. The launch-list form on any marketing page POSTs to
`/api/launch-list` (a Next.js route handler), which proxies server-side to the NestJS API's
`POST /api/v1/launch-list`.

## Verified feature claims and their source

Every claim on the site is centralized in `apps/web/src/lib/site-config.ts` (`CLAIMS` array) with
its source file/doc cited inline. Summary:

| Claim | Source |
|---|---|
| A 0–100 Search Health score that stays explainable over time, weighted not pass/fail | `docs/SCORING.md`; `apps/api` `AuditScore` model |
| Forge Priorities (severity/impact/effort/affected pages) | `docs/PRODUCT.md`; `apps/api/src/issues` |
| A real, direct crawl respecting robots.txt/sitemap | `packages/crawler`; `apps/worker` |
| Six audit categories (Technical, Indexability, Content, Performance, Internal Linking, Structured Data) | `docs/PRODUCT.md`; `docs/SCORING.md` |
| Crawl comparison (score deltas, fixed/new/persistent issues) | `docs/PRODUCT.md` Phase 13; `apps/api/test/crawl-comparison.e2e-spec.ts` |
| Reports computed live + CSV export | `apps/api/src/reports`; `apps/api/src/reports/csv.util.ts` |
| Multi-tenant orgs/projects/sites | `packages/database/prisma/schema.prisma` |
| Optional real-browser performance sampling | `packages/performance`; `.env.example` `CHROMIUM_EXECUTABLE_PATH` |

Deliberately **not claimed** anywhere on the site (all confirmed absent from the codebase by
searching for cron/schedule/Stripe/payment/webhook/OAuth-integration code): keyword tracking,
backlink index, rank tracking, GSC/GA integration, a generative AI assistant, recurring/scheduled
crawls, white-labeling/client portals, testimonials, customer logos, accuracy percentages,
certifications, or "unlimited" usage. The in-house-teams and agencies solution pages each include
an explicit "here's what we don't have yet" callout rather than staying silent about the gap.

## Keyword-to-page map

See `KEYWORD_PAGE_MAP` in `apps/web/src/lib/site-config.ts` — one primary keyword + intent per
marketing page, derived from the actual capability set above (not aspirational SEO terms).

## Pricing, content, nav, FAQ, and SEO config

All centralized in `apps/web/src/lib/site-config.ts`:

- `COMMERCIAL_STATE` / `IS_PRELAUNCH` — the single flag gating the site's commercial posture (see below).
- `PRICING` — amount, currency, framing string ("Expected launch price"). Every place the price is
  rendered reads `PRICING.displayFull`/`displayPrice`/`framing`, so a price change is one edit.
- `PRIMARY_NAV`, `SOLUTIONS_NAV`, `FOOTER_PRODUCT_NAV`, `FOOTER_LEGAL_NAV` — navigation.
- `CLAIMS` — every verified product claim with its source.
- `FAQ_ITEMS` — homepage/pricing FAQ content, also used to build `FAQPage` JSON-LD.
- `SITE_ORIGIN`, `CONTACT_EMAIL`, `SITE_NAME`, `SITE_TAGLINE` — identity/contact.
- `KEYWORD_PAGE_MAP` — SEO keyword targeting per page.

Structured data lives in `apps/web/src/components/marketing/StructuredData.tsx`
(`Organization`, `WebSite`, `SoftwareApplication`, `FAQPage` JSON-LD). No `AggregateRating`,
`Review`, or `Offer` schema is emitted — there are no real reviews and no live price to transact
against.

## Lead capture (launch list)

- **Data model**: `LaunchListSignup` in `packages/database/prisma/schema.prisma` (migration
  `20260920145655_add_launch_list_signup`). Fields: `email` (unique), optional `name`/`company`/`role`/`source`, `createdAt`. Intentionally has no relation to `User`/`Organization` — joining the
  list never creates a product account.
- **API**: `POST /api/v1/launch-list` (`apps/api/src/launch-list/*`), `@Public()` (no session
  required) and throttled to 5 requests/minute/IP on top of the global 120/minute default
  (`ThrottlerModule` in `app.module.ts`).
  - **Validation**: `class-validator` on `CreateLaunchListSignupDto` (`@IsEmail`, length caps, an
    allow-list for `source`).
  - **Dedup**: unique constraint on `email` (lowercased/trimmed before insert); a repeat signup
    returns the same `{status: "confirmed"}` response rather than an error or a "you're already on
    the list" message, so the endpoint never confirms or denies whether an address is already
    present.
  - **Bot protection**: a honeypot field (`website`) that's visually hidden and removed from the
    tab order in the real form; if it arrives non-empty, the request returns success but nothing is
    written. Combined with the per-IP throttle above.
  - **Accessible errors**: the form (`LaunchListForm.tsx`) surfaces inline `role="alert"` field
    errors and a `role="status"` success message; the success message never claims delivery beyond
    what's true ("we'll email you" — no confirmation email is actually sent yet, see below).
- **Web**: `apps/web/src/app/api/launch-list/route.ts` is a Next.js route handler that proxies to
  the API server-side (avoids CORS and the authenticated-session CSRF dance that `apiFetch` uses
  for logged-in product calls) and forwards `X-Forwarded-For` so the API's per-IP throttle can key
  on the real visitor rather than this proxy.
- **Tests**: `apps/api/test/launch-list.e2e-spec.ts` — real HTTP requests against a real Nest app +
  Postgres, covering: persistence, case-insensitive dedup without leaking existence, malformed
  email rejection, unknown-field rejection (whitelist), honeypot discard, and throttling (each test
  uses its own app instance so the tight 5/min throttle window doesn't make unrelated assertions
  flaky). `apps/web/src/lib/launch-list-validation.spec.ts` and `site-config.spec.ts` cover the
  client-side email check and the commercial-state/pricing-framing invariants.

### Deployment requirements for the launch list

- The API's per-IP throttle relies on `req.ip`. Behind a reverse proxy in production, NestJS needs
  `app.set('trust proxy', ...)` (or equivalent) configured so it reads the real client IP from
  `X-Forwarded-For` rather than the proxy's own address — this is **not yet configured** and should
  be added before launch, alongside the Next.js route handler's forwarding (already implemented).
- `ThrottlerModule`'s default storage is in-memory per API process. If the API runs as multiple
  instances/replicas in production, the per-IP limit is per-instance, not global — a determined
  submitter could get `instances × 5` requests/minute. A shared store (e.g. `@nestjs/throttler`'s
  Redis storage, given Redis is already a runtime dependency) should replace the default before
  launch if this matters at your expected traffic/abuse level.
- **No outbound email is sent for launch-list signups.** The success copy says "we'll email you,"
  which describes the *intended* future behavior, not something this change implements. `docs/OPERATIONS.md`'s console-transport-by-default SMTP setup (used today for password reset) is the
  natural mechanism to reuse for an actual "you're on the list" or "we've launched" email, but
  wiring that up was out of scope here — **this could not be verified to send real email** because
  no SMTP credentials exist in this environment. Confirmed manually via the API/Postgres only: a
  POST to `/api/v1/launch-list` persists a row in `launch_list_signups`.

## Prelaunch vs. live commercial state

The entire site currently assumes `COMMERCIAL_STATE = "prelaunch"` (`apps/web/src/lib/site-config.ts`). Concretely:

- Every pricing/subscribe CTA site-wide links to `/launch-list` or embeds `<LaunchListForm>` —
  none link to a checkout, because no checkout exists anywhere in this repo (no Stripe, no
  payments module — confirmed by search).
- The pricing page explicitly states nothing is billed today and the price is "subject to change."
- Terms/Privacy both state no paid subscription terms are in effect yet.
- There is no server-side "purchase" endpoint to reject — protection here is structural (the
  endpoint doesn't exist) rather than a runtime gate. If real billing is ever added, it should be
  built as a new, separate, explicitly-reviewed feature; `COMMERCIAL_STATE` flipping to `"live"`
  should be treated as a signal that such a build has already shipped, not as the thing that ships it.

## Known limitations / what remains required for public launch

- **No SMTP configured** — launch-list confirmation/notification email is unverified (see above).
- **No registered legal entity, governing law, or counsel-reviewed Privacy Policy/Terms** — the
  `/privacy` and `/terms` pages are explicitly labeled "Draft — prelaunch" and say so in their body
  copy; they cover only this marketing site and the launch list, not a future paid product.
- **No VAT/tax presentation** — `€79.99/month` is shown without a stated tax treatment (VAT-inclusive
  vs. exclusive), which needs a decision before real billing exists.
- **Final pricing is not approved** — the page frames it as "Expected launch price" throughout, per
  the brief's requirement, but €79.99/month is a placeholder pending real commercial sign-off.
- **No live billing/checkout** — by design, not an oversight; building one was explicitly out of
  scope and prohibited for this change.
- **Throttler production hardening** — trust-proxy config and shared (Redis) throttle storage, both
  noted above, are not yet done.
- **No Resources/blog articles** — omitted rather than fabricated (see "Routes" above).
- **`prefers-reduced-motion` fallback** was verified by code review (every `art/*` component checks
  `usePrefersReducedMotion()` — backed by `window.matchMedia("(prefers-reduced-motion: reduce)")`
  — and renders fully static JSX, no refs/pins/ScrollTrigger, when it matches) rather than a live
  OS-level accessibility-setting toggle, since the available browser tooling in this environment
  does not expose that specific media-query emulation.
- **`WebsiteAnatomy` card positions on very narrow phones** — clamped to an 18–82% horizontal band
  and narrowed to `w-32` below `sm:` to stop cards from clipping at 390px, but the layout is still a
  scattered/absolute one adapted from desktop rather than a purpose-built mobile arrangement; it's
  visually workable but not the tightest possible mobile treatment.
- **The launch-list API wasn't running during this pass's browser verification** (only
  `apps/web`'s dev server was started, not `apps/api`), so the form's error state (not the success
  state) is what got exercised live — confirmed correct/honest either way (see
  `LaunchListForm.tsx`), but the success path wasn't re-verified visually after this redesign.
