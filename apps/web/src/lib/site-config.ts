/**
 * Central configuration for the public marketing site: navigation, commercial
 * state, pricing, verified claims, and contact/site metadata. Marketing pages
 * should read from here rather than hardcoding copy, so a pricing change, a
 * launch, or a claim correction happens in one place. See docs/MARKETING_SITE.md.
 */

// ────────────────────────────────────────────────────────────────────
// Commercial state
// ────────────────────────────────────────────────────────────────────

/**
 * The site has exactly one commercial state today: "prelaunch". There is no
 * billing/checkout code anywhere in this repo (no Stripe, no payments
 * module), so every subscribe/pricing CTA on the site must route to the
 * launch list, never to a purchase flow. `COMMERCIAL_STATE` exists so that
 * if a real billing integration ships later, flipping this one flag (plus
 * building the actual checkout it would gate) is the single place that
 * changes — it is not a toggle anyone should flip today.
 */
export const COMMERCIAL_STATE: "prelaunch" | "live" = "prelaunch";

export const IS_PRELAUNCH = COMMERCIAL_STATE === "prelaunch";

// ────────────────────────────────────────────────────────────────────
// Site identity
// ────────────────────────────────────────────────────────────────────

export const SITE_NAME = "SearchAnvil";
export const SITE_TAGLINE = "Forge Better Search Performance";
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://searchanvil.com";
export const CONTACT_EMAIL = "hello@searchanvil.com";

// ────────────────────────────────────────────────────────────────────
// Pricing
// ────────────────────────────────────────────────────────────────────

export const PRICING = {
  amount: 79.99,
  currency: "EUR",
  currencySymbol: "€",
  interval: "month" as const,
  /** Always render this framing next to the number — never a bare price. */
  framing: "Expected launch price",
  displayPrice: "€79.99",
  displayFull: "€79.99/month",
};

// ────────────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Platform", href: "/platform" },
  {
    label: "Solutions",
    href: "/solutions/seo-professionals",
  },
  { label: "Pricing", href: "/pricing" },
];

export const SOLUTIONS_NAV: NavItem[] = [
  { label: "SEO Professionals", href: "/solutions/seo-professionals" },
  { label: "Agencies", href: "/solutions/agencies" },
  { label: "In-House Teams", href: "/solutions/in-house-teams" },
];

export const FOOTER_PRODUCT_NAV: NavItem[] = [
  { label: "Platform", href: "/platform" },
  { label: "Pricing", href: "/pricing" },
  { label: "SEO Professionals", href: "/solutions/seo-professionals" },
  { label: "Agencies", href: "/solutions/agencies" },
  { label: "In-House Teams", href: "/solutions/in-house-teams" },
];

export const FOOTER_LEGAL_NAV: NavItem[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

// ────────────────────────────────────────────────────────────────────
// Verified claims — every claim rendered on the marketing site should
// trace back to an entry here (or be a direct quote from docs/). See
// docs/MARKETING_SITE.md "Verified feature claims and their source" for
// the file/line each of these is grounded in.
// ────────────────────────────────────────────────────────────────────

export interface Claim {
  id: string;
  claim: string;
  source: string;
}

export const CLAIMS: Claim[] = [
  {
    id: "search-health",
    claim: "A single 0–100 Search Health score that stays explainable over time, weighted by severity, impact, confidence, and how much of the site is affected — not a pass/fail tally.",
    source: "docs/SCORING.md; apps/api AuditScore model",
  },
  {
    id: "forge-priorities",
    claim: "Every issue ranked by severity, impact, effort, and how many pages it actually touches.",
    source: "docs/PRODUCT.md 'Forge Priorities'; apps/api/src/issues",
  },
  {
    id: "crawl",
    claim: "A real, direct crawl of your website that respects robots.txt and your sitemap — not a cached third-party index.",
    source: "packages/crawler; apps/worker",
  },
  {
    id: "categories",
    claim: "Six audit categories: Technical, Indexability, Content, Performance, Internal Linking, Structured Data.",
    source: "docs/PRODUCT.md; docs/SCORING.md",
  },
  {
    id: "comparison",
    claim: "Compare any two crawls of the same site: score deltas, new/fixed/persistent issues, improved/worsened pages.",
    source: "docs/PRODUCT.md 'Crawl Comparison', Phase 13; apps/api/test/crawl-comparison.e2e-spec.ts",
  },
  {
    id: "reports",
    claim: "Reports computed live from the latest crawl, with CSV export (rule, category, severity, impact, effort, affected pages, priority score).",
    source: "apps/api/src/reports; apps/api/src/reports/csv.util.ts",
  },
  {
    id: "multi-tenant",
    claim: "Multi-tenant organizations, each with multiple projects and websites.",
    source: "packages/database/prisma/schema.prisma Organization/Project/Site models",
  },
  {
    id: "performance",
    claim: "Optional real-browser performance sampling per page, layered on top of the crawl when it's available.",
    source: "packages/performance; apps/worker; .env.example CHROMIUM_EXECUTABLE_PATH",
  },
];

// ────────────────────────────────────────────────────────────────────
// FAQ
// ────────────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is SearchAnvil available today?",
    answer:
      "Not yet. SearchAnvil is in prelaunch — the product exists and is under active development, but there is no public signup or billing yet. Join the launch list and we'll email you the moment general availability opens.",
  },
  {
    question: "What exactly does SearchAnvil check?",
    answer:
      "SearchAnvil crawls your website and audits it across six categories: Technical, Indexability, Content, Performance, Internal Linking, and Structured Data. Every finding is a Forge Priority — ranked by severity, impact, effort, and how many pages it affects — not a raw list of warnings.",
  },
  {
    question: "How is the Search Health score calculated?",
    answer:
      "It's a 0–100 score per category, weighted by issue severity, our confidence in the finding, and how much of the site is actually affected — then averaged across categories. Every score keeps a full explanation attached, so you can always see why it landed where it did, even months later.",
  },
  {
    question: "Is SearchAnvil a keyword-rank tracker or an all-in-one marketing suite?",
    answer:
      "No. SearchAnvil deliberately does not include a keyword database, rank tracking, backlink index, or PPC/social/CRM tooling. It does one thing — technical SEO auditing — based on what a crawl of your own site can actually prove, not third-party estimates.",
  },
  {
    question: "Does SearchAnvil use AI to write my SEO strategy?",
    answer:
      "No generative AI assistant is part of SearchAnvil. Every finding comes from crawled facts checked against a fixed set of rules, so the same site always produces the same result and you can trace any issue back to real evidence, not a generated guess.",
  },
  {
    question: "What will the price be?",
    answer:
      `${PRICING.displayFull} is our expected launch price, covering your organization's projects and websites in full. Nothing is being charged now — pricing is not final until general availability, and joining the launch list carries no payment obligation.`,
  },
  {
    question: "Can I compare results over time?",
    answer:
      "Yes — crawl comparison shows Search Health before/after, which issues were fixed, which are new, which persisted, and which pages improved or got worse, all derived from stored crawl data rather than a generated summary.",
  },
  {
    question: "Does SearchAnvil integrate with Google Search Console or Analytics?",
    answer:
      "Not in this release. SearchAnvil's findings come entirely from its own crawler and audit engine, so what it reports is something it can independently verify rather than passthrough data from another tool.",
  },
];

// ────────────────────────────────────────────────────────────────────
// Keyword-to-page SEO map (see docs/MARKETING_SITE.md for rationale)
// ────────────────────────────────────────────────────────────────────

export const KEYWORD_PAGE_MAP: Array<{ path: string; primaryKeyword: string; intent: string }> = [
  { path: "/", primaryKeyword: "technical SEO audit platform", intent: "brand + category landing" },
  { path: "/platform", primaryKeyword: "technical SEO audit tool", intent: "product/feature deep-dive" },
  { path: "/solutions/seo-professionals", primaryKeyword: "SEO audit software for consultants", intent: "role-based solution" },
  { path: "/solutions/agencies", primaryKeyword: "technical SEO tool for agencies", intent: "role-based solution" },
  { path: "/solutions/in-house-teams", primaryKeyword: "in-house technical SEO monitoring", intent: "role-based solution" },
  { path: "/pricing", primaryKeyword: "SearchAnvil pricing", intent: "commercial/pricing" },
  { path: "/launch-list", primaryKeyword: "SearchAnvil early access", intent: "lead capture" },
];
