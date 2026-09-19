import { occurrence } from "../rule-helpers";
import type { AuditRuleDefinition } from "../types";

const brokenInternalLink: AuditRuleDefinition = {
  key: "broken-internal-link",
  version: 1,
  name: "Broken internal link",
  category: "INTERNAL_LINKING",
  defaultSeverity: "HIGH",
  defaultEffort: "EASY",
  weight: 7,
  description: "The page links internally to another page that returned a 4xx/5xx status.",
  whyItMatters:
    "Broken internal links waste crawl budget, break the user journey, and dilute the link equity that would otherwise flow to a working page.",
  recommendation: "Update the link to point to a working URL, or remove it.",
  evaluate: (site) => {
    const byId = new Map(site.pages.map((p) => [p.id, p]));
    return site.pages.flatMap((p) =>
      p.outboundLinks
        .filter((link) => link.isInternal && link.targetPageId)
        .flatMap((link) => {
          const target = byId.get(link.targetPageId as string);
          if (!target || (target.statusCode ?? 0) < 400) return [];
          return [
            occurrence(p, {
              targetUrl: link.targetUrl,
              targetStatusCode: target.statusCode,
              anchorText: link.anchorText,
            }),
          ];
        }),
    );
  },
};

const internalLinkToRedirect: AuditRuleDefinition = {
  key: "internal-link-to-redirect",
  version: 1,
  name: "Internal link to a redirecting URL",
  category: "INTERNAL_LINKING",
  defaultSeverity: "LOW",
  defaultEffort: "EASY",
  weight: 2,
  description: "The page links internally to a URL that itself redirects elsewhere.",
  whyItMatters:
    "Linking directly to the final URL avoids an unnecessary redirect hop, which is faster for users and preserves link equity more efficiently.",
  recommendation: "Update the link to point directly at the final destination URL.",
  evaluate: (site) => {
    const byId = new Map(site.pages.map((p) => [p.id, p]));
    return site.pages.flatMap((p) =>
      p.outboundLinks
        .filter((link) => link.isInternal && link.targetPageId)
        .flatMap((link) => {
          const target = byId.get(link.targetPageId as string);
          if (!target || target.redirectChain.length === 0) return [];
          return [
            occurrence(p, {
              targetUrl: link.targetUrl,
              finalUrl: target.url,
            }),
          ];
        }),
    );
  },
};

const orphanPage: AuditRuleDefinition = {
  key: "orphan-page",
  version: 1,
  name: "Orphan page",
  category: "INTERNAL_LINKING",
  defaultSeverity: "MEDIUM",
  defaultEffort: "MEDIUM",
  weight: 4,
  description: "No other crawled page links internally to this one.",
  whyItMatters:
    "A page with no internal links pointing to it is hard for both users and search engines to discover through normal navigation — it depends entirely on being linked externally or listed in a sitemap.",
  recommendation: "Add internal links to this page from relevant related content or navigation.",
  evaluate: (site) => {
    if (site.pages.length <= 1) return [];
    const linkedPageIds = new Set(
      site.pages.flatMap((p) =>
        p.outboundLinks.filter((l) => l.isInternal && l.targetPageId).map((l) => l.targetPageId as string),
      ),
    );
    return site.pages
      .filter((p) => p.depth > 0 && !linkedPageIds.has(p.id))
      .map((p) => occurrence(p, {}));
  },
};

export const internalLinkingRules: AuditRuleDefinition[] = [
  brokenInternalLink,
  internalLinkToRedirect,
  orphanPage,
];
