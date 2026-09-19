# Phase 15 — Public Website

**Status: COMPLETE — gate passed.**

## Scope implemented

Replaced the `apps/web/src/app/page.tsx` placeholder (which explicitly said "the full marketing
site... land in later build phases") with a real, static marketing homepage:

- **Header**: wordmark + Sign in / Get started, linking to the existing `/login`/`/register` auth
  routes (no new auth surface needed — those already exist since Phase 03).
- **Hero**: the "Forge Better Search Performance" tagline plus a one-paragraph positioning
  statement, with primary/secondary CTAs.
- **"Five questions, answered"**: one card per question from `docs/PRODUCT.md`'s "The five
  questions" — this ties the marketing copy directly to the actual, already-implemented product
  behavior (Search Health, Forge Priorities, Pages, Crawl Comparison) rather than writing
  aspirational copy for features that don't exist.
- **"The core loop"**: the exact `PROJECT → WEBSITE → CRAWL → ... → COMPARISON` loop from
  `docs/PRODUCT.md`, rendered as a literal flow of steps in the mono font — the same loop used
  internally as the architectural spine, shown to visitors as-is rather than reworded into vaguer
  marketing language.
- **Differentiation section**: "Not another all-in-one suite," directly listing the same
  deliberate exclusions documented in `docs/PRODUCT.md`'s "Out of scope for this release" — no
  keyword database, no backlink index, no PPC/CRM, no generative AI assistant. Consistent
  messaging between what's marketed and what's genuinely out of scope, not overselling.
- **Footer**: minimal, same two auth links.

No new components were added to `packages/ui` — the page uses the existing design tokens
(`forge`/`steel`/`ember` classes) directly, since this is a one-off static page, not a reusable
pattern; introducing a marketing-specific component library was not warranted by the scope of one
page.

## Key files

- `apps/web/src/app/page.tsx` (rewritten)

## Tests added

None — this is static, non-interactive marketing content with no logic to unit test. Verified by
build (prerendered as static content, confirmed in the Next.js build output) and a live browser
check instead, consistent with how every other purely-presentational page in this codebase is
verified.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

`pnpm build`: 10/10 — `/` now shows `○ (Static) prerendered as static content` in the route table
(previously already static, but now with real content instead of the placeholder). `pnpm
typecheck`: 17/17. `pnpm lint`: 17/17. `pnpm test`: 17/17 (unchanged — no new test files, and no
existing ones reference the old placeholder copy). `pnpm test:e2e`: 11/11, 66 e2e tests (unchanged
— nothing here touches the API).

## Manual verification

Ran the web dev server standalone (no API/worker needed — the page makes no network calls) and
confirmed in the browser at both desktop and 375×812 mobile widths:

- Hero, all 5 question cards, the full 10-step core loop (wrapping correctly on narrow viewports
  via `flex-wrap`), the differentiation section, and the footer all render correctly with no
  layout overflow.
- Header CTAs point at the correct existing routes (verified via the accessibility tree, not just
  visually) — `Sign in` → `/login`, `Get started`/`Start your first audit` → `/register`.
- Stopped the dev server cleanly afterward.

## Architecture decisions

**No CMS, no dynamic content.** The homepage is a plain static Next.js page with hardcoded arrays
for the questions and loop steps — there is no product requirement for marketing copy to be
editable without a deploy, and adding a CMS integration would be speculative scope well beyond
what Phase 15 asks for.

**Marketing copy is drawn directly from `docs/PRODUCT.md`, not freshly invented.** Every claim on
the page (the five questions, the core loop, the exclusions) already exists as documented product
truth and, for the five questions, as *implemented and live-verified* features from Phases 08–14.
This avoids the classic SaaS-marketing-page failure mode of promising something the product
doesn't actually do yet.

## Bugs found during self-audit and fixes made

None — a static content page with no data dependencies had nothing to go wrong at the logic level;
build/typecheck/lint passed on the first attempt, and the live browser check matched the intended
layout exactly.

## Known limitations / technical debt

- Single page only — no `/pricing`, `/about`, `/blog`, or docs pages. Not a gap against this
  phase's scope (`docs/PRODUCT.md` describes a single "Public SaaS website" surface, and the
  master build spec explicitly excludes complex billing, which is what a pricing page would need
  to be honest about), just worth stating so it doesn't read as an oversight later.
- No SEO metadata beyond the existing root `layout.tsx` `<title>`/`<description>` (Open Graph tags,
  a sitemap, structured data for the marketing site itself) — reasonable to add later but not
  required for an internal/pre-launch audit tool's own marketing page at this stage.

## Security considerations

None beyond what already applies to every page in this app (CSP, standard security headers — see
`docs/SECURITY.md`) — this page has no forms, no user input, and no data fetching.

## Readiness for next phase

Gate met: a real public-facing homepage exists in place of the "placeholder" the app previously
shipped, verified live at desktop and mobile widths, with copy that accurately reflects the actual
implemented product. Proceeding to Phase 16 (Product Polish).
