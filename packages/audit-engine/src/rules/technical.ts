import { occurrence } from "../rule-helpers";
import type { AuditRuleDefinition } from "../types";

const httpServerError: AuditRuleDefinition = {
  key: "http-5xx-error",
  version: 1,
  name: "Server error",
  category: "TECHNICAL",
  defaultSeverity: "CRITICAL",
  defaultEffort: "MEDIUM",
  weight: 10,
  confidence: 1.0,
  description: "The page returned a 5xx server error instead of content.",
  whyItMatters:
    "A 5xx response means the server itself failed to generate the page — search engines will drop it from the index if it persists, and every visitor hitting it sees a broken page.",
  recommendation: "Check server/application logs for the cause and fix the underlying error.",
  evaluate: (site) =>
    site.pages
      .filter((p) => (p.statusCode ?? 0) >= 500)
      .map((p) => occurrence(p, { statusCode: p.statusCode })),
};

const httpClientError: AuditRuleDefinition = {
  key: "http-4xx-error",
  version: 1,
  name: "Broken page (4xx)",
  category: "TECHNICAL",
  defaultSeverity: "HIGH",
  defaultEffort: "MEDIUM",
  weight: 8,
  confidence: 1.0,
  description: "The page returned a 4xx error (e.g. 404 Not Found).",
  whyItMatters:
    "A 4xx page is unreachable for both users and search engines. If it's linked from elsewhere on the site or indexed already, it wastes crawl budget and breaks the user journey.",
  recommendation:
    "Restore the page, or if it's meant to be gone, remove internal links to it and consider a 301 redirect to a relevant replacement.",
  evaluate: (site) =>
    site.pages
      .filter((p) => {
        const status = p.statusCode ?? 0;
        return status >= 400 && status < 500;
      })
      .map((p) => occurrence(p, { statusCode: p.statusCode })),
};

const redirectChainTooLong: AuditRuleDefinition = {
  key: "redirect-chain-too-long",
  version: 1,
  name: "Long redirect chain",
  category: "TECHNICAL",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 4,
  confidence: 0.9,
  description: "The page is reached through two or more chained redirects.",
  whyItMatters:
    "Each redirect hop adds latency and dilutes link equity; search engines may also give up following very long chains.",
  recommendation: "Point the original link/reference directly at the final destination URL.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.redirectChain.length >= 2)
      .map((p) => occurrence(p, { hops: p.redirectChain.length, chain: p.redirectChain })),
};

const missingH1: AuditRuleDefinition = {
  key: "missing-h1",
  version: 1,
  name: "Missing H1",
  category: "TECHNICAL",
  defaultSeverity: "HIGH",
  defaultEffort: "EASY",
  weight: 6,
  confidence: 0.85,
  description: "The page has no H1 heading.",
  whyItMatters:
    "The H1 is the primary signal of what a page is about, for both readers scanning the page and search engines. Pages without one lack a clear topical anchor.",
  recommendation: "Add a single, descriptive H1 that summarizes the page's main topic.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.statusCode === 200 && !p.headings.some((h) => h.level === 1))
      .map((p) => occurrence(p, {})),
};

const multipleH1: AuditRuleDefinition = {
  key: "multiple-h1",
  version: 1,
  name: "Multiple H1 headings",
  category: "TECHNICAL",
  defaultSeverity: "LOW",
  defaultEffort: "EASY",
  weight: 2,
  confidence: 0.5,
  description: "The page has more than one H1 heading.",
  whyItMatters:
    "Multiple H1s dilute the page's topical signal — it's no longer clear which heading is the primary one. Not always harmful (some design systems use several intentionally), so treat this as worth reviewing rather than an automatic error.",
  recommendation: "Keep one H1 for the page's main topic and demote the others to H2+.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.headings.filter((h) => h.level === 1).length > 1)
      .map((p) =>
        occurrence(p, { count: p.headings.filter((h) => h.level === 1).length }),
      ),
};

const nonHttpsPage: AuditRuleDefinition = {
  key: "non-https-page",
  version: 1,
  name: "Page served over HTTP, not HTTPS",
  category: "TECHNICAL",
  defaultSeverity: "HIGH",
  defaultEffort: "MEDIUM",
  weight: 7,
  confidence: 1.0,
  description: "The page is served over an unencrypted HTTP connection.",
  whyItMatters:
    "Browsers flag HTTP pages as \"Not Secure,\" and search engines treat HTTPS as a ranking signal. Unencrypted connections are also vulnerable to tampering.",
  recommendation: "Serve the page over HTTPS and redirect HTTP requests to the HTTPS version.",
  evaluate: (site) =>
    site.pages.filter((p) => p.url.startsWith("http://")).map((p) => occurrence(p, {})),
};

const mixedContent: AuditRuleDefinition = {
  key: "mixed-content",
  version: 1,
  name: "Mixed content",
  category: "TECHNICAL",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 4,
  confidence: 0.9,
  description: "An HTTPS page references HTTP (unencrypted) resources.",
  whyItMatters:
    "Browsers may block or warn about insecure sub-resources loaded on an otherwise secure page, and it undermines the security benefit of HTTPS.",
  recommendation: "Update the referenced image/link URLs to use HTTPS.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.url.startsWith("https://"))
      .flatMap((p) => {
        const httpImages = p.images.filter((img) => img.src.startsWith("http://"));
        const httpLinks = p.outboundLinks.filter((l) => l.targetUrl.startsWith("http://"));
        if (httpImages.length === 0 && httpLinks.length === 0) return [];
        return [
          occurrence(p, {
            httpImageCount: httpImages.length,
            httpLinkCount: httpLinks.length,
          }),
        ];
      }),
};

const sitemapNotFound: AuditRuleDefinition = {
  key: "sitemap-not-found",
  version: 1,
  name: "No sitemap discovered",
  category: "TECHNICAL",
  defaultSeverity: "LOW",
  defaultEffort: "EASY",
  weight: 2,
  confidence: 0.5,
  description: "No XML sitemap was found via robots.txt or the default /sitemap.xml location.",
  whyItMatters:
    "A sitemap helps search engines discover and prioritize pages efficiently, especially on larger sites. Small sites can rely on internal links alone, so this is a minor, contextual finding.",
  recommendation: "Publish an XML sitemap and reference it from robots.txt.",
  evaluate: (site) => {
    if (site.sitemapUrls.length > 0) return [];
    // Site-wide finding: attach to the crawl's start page (depth 0) as the
    // representative page, since occurrences are always page-scoped. If
    // there's genuinely no page to attach to, there's nothing to report.
    const startPage = site.pages.find((p) => p.depth === 0);
    return startPage ? [occurrence(startPage, {})] : [];
  },
};

const sitemapUrlError: AuditRuleDefinition = {
  key: "sitemap-url-error",
  version: 1,
  name: "Sitemap URL returns an error",
  category: "TECHNICAL",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 5,
  confidence: 0.95,
  description: "A URL listed in the sitemap returned a 4xx/5xx status when crawled.",
  whyItMatters:
    "Sitemaps should only list URLs that actually work — listing broken URLs wastes crawl budget and signals poor sitemap hygiene to search engines.",
  recommendation: "Remove the broken URL from the sitemap or fix the underlying page.",
  evaluate: (site) => {
    const sitemapUrlSet = new Set(site.sitemapUrls);
    return site.pages
      .filter((p) => sitemapUrlSet.has(p.url) && (p.statusCode ?? 0) >= 400)
      .map((p) => occurrence(p, { statusCode: p.statusCode }));
  },
};

export const technicalRules: AuditRuleDefinition[] = [
  httpServerError,
  httpClientError,
  redirectChainTooLong,
  missingH1,
  multipleH1,
  nonHttpsPage,
  mixedContent,
  sitemapNotFound,
  sitemapUrlError,
];
