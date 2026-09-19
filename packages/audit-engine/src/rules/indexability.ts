import { declaresNoindex, isSuccessfulHtmlPage, occurrence } from "../rule-helpers";
import type { AuditRuleDefinition } from "../types";

const pageNoindexed: AuditRuleDefinition = {
  key: "page-noindexed",
  version: 1,
  name: "Page is set to noindex",
  category: "INDEXABILITY",
  defaultSeverity: "NOTICE",
  defaultEffort: "EASY",
  weight: 3,
  description: "The page declares noindex via meta robots or the X-Robots-Tag header.",
  whyItMatters:
    "A noindex page will never appear in search results. This is often intentional (staging pages, thank-you pages), so it's flagged for review rather than treated as an automatic error — confirm it's meant to be excluded.",
  recommendation: "If this page should be discoverable in search, remove the noindex directive.",
  evaluate: (site) =>
    site.pages.filter((p) => !p.isIndexable).map((p) => occurrence(p, { metaRobots: p.metaRobots, xRobotsTag: p.xRobotsTag })),
};

const conflictingIndexabilitySignals: AuditRuleDefinition = {
  key: "conflicting-indexability-signals",
  version: 1,
  name: "Conflicting indexability signals",
  category: "INDEXABILITY",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 4,
  description: "Meta robots and the X-Robots-Tag header disagree about whether to index the page.",
  whyItMatters:
    "When on-page and header-level directives conflict, different crawlers may resolve the ambiguity differently, leading to unpredictable indexing behavior.",
  recommendation: "Make the meta robots tag and X-Robots-Tag header agree on indexability.",
  evaluate: (site) =>
    site.pages
      .filter((p) => declaresNoindex(p.metaRobots) !== declaresNoindex(p.xRobotsTag))
      .map((p) => occurrence(p, { metaRobots: p.metaRobots, xRobotsTag: p.xRobotsTag })),
};

const missingCanonical: AuditRuleDefinition = {
  key: "missing-canonical",
  version: 1,
  name: "Missing canonical tag",
  category: "INDEXABILITY",
  defaultSeverity: "NOTICE",
  defaultEffort: "EASY",
  weight: 2,
  description: "The page has no canonical tag.",
  whyItMatters:
    "A canonical tag tells search engines which URL is the authoritative version when the same content is reachable multiple ways. Not every page needs one — this is contextual, not a hard error.",
  recommendation: "Add a self-referencing canonical tag, or point it at the authoritative URL if this page is a variant.",
  evaluate: (site) =>
    site.pages.filter((p) => isSuccessfulHtmlPage(p) && !p.canonicalUrl).map((p) => occurrence(p, {})),
};

const invalidCanonicalUrl: AuditRuleDefinition = {
  key: "invalid-canonical-url",
  version: 1,
  name: "Invalid canonical URL",
  category: "INDEXABILITY",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 4,
  description: "The canonical tag's URL is not a well-formed absolute URL.",
  whyItMatters:
    "A malformed canonical is ignored or misinterpreted by search engines, which defeats its purpose of consolidating duplicate content signals.",
  recommendation: "Fix the canonical tag to point to a well-formed absolute URL.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.canonicalUrl && !isWellFormedUrl(p.canonicalUrl))
      .map((p) => occurrence(p, { canonicalUrl: p.canonicalUrl })),
};

const canonicalPointsToNon200: AuditRuleDefinition = {
  key: "canonical-points-to-non-200",
  version: 1,
  name: "Canonical points to a non-200 page",
  category: "INDEXABILITY",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 5,
  description: "The canonical URL resolves to a page in this crawl that did not return 200.",
  whyItMatters:
    "A canonical should point to the working, authoritative version of a page. Pointing to a broken or redirecting URL undermines the consolidation it's meant to provide.",
  recommendation: "Point the canonical at a URL that returns 200 directly.",
  evaluate: (site) => {
    const byUrl = new Map(site.pages.map((p) => [p.url, p]));
    return site.pages
      .filter((p) => p.canonicalUrl)
      .flatMap((p) => {
        const target = byUrl.get(p.canonicalUrl as string);
        if (!target || target.statusCode === 200) return [];
        return [occurrence(p, { canonicalUrl: p.canonicalUrl, targetStatusCode: target.statusCode })];
      });
  },
};

const sitemapContainsNonIndexableUrl: AuditRuleDefinition = {
  key: "sitemap-contains-non-indexable-url",
  version: 1,
  name: "Sitemap lists a non-indexable URL",
  category: "INDEXABILITY",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 4,
  description: "A URL in the sitemap resolves to a page that is set to noindex.",
  whyItMatters:
    "Listing noindex pages in a sitemap sends search engines a contradictory signal — you're asking them to crawl a page you've also told them not to index.",
  recommendation: "Remove noindex pages from the sitemap, or remove the noindex directive if they should be indexed.",
  evaluate: (site) => {
    const sitemapUrlSet = new Set(site.sitemapUrls);
    return site.pages
      .filter((p) => sitemapUrlSet.has(p.url) && !p.isIndexable)
      .map((p) => occurrence(p, {}));
  },
};

function isWellFormedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const indexabilityRules: AuditRuleDefinition[] = [
  pageNoindexed,
  conflictingIndexabilitySignals,
  missingCanonical,
  invalidCanonicalUrl,
  canonicalPointsToNon200,
  sitemapContainsNonIndexableUrl,
];
