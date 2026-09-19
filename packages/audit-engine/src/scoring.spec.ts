import { describe, expect, it } from "vitest";
import { computeSearchHealth, computePenalty, SCORING_VERSION } from "./scoring";
import { runAudit } from "./run-audit";
import { buildPage, buildSite } from "./fixtures/page-builder";
import { ALL_RULES, getRuleByKey } from "./rule-registry";

describe("computeSearchHealth (deterministic — Phase 08 gate)", () => {
  it("scores a perfectly clean site at 100 across every category", () => {
    const site = buildSite([buildPage({ depth: 0, canonicalUrl: "https://example.com/page-1" })], {
      sitemapUrls: ["https://example.com/sitemap.xml"],
    });
    const issues = runAudit(site, ALL_RULES);
    const result = computeSearchHealth(site, issues);

    expect(result.overallScore).toBe(100);
    for (const score of Object.values(result.categoryScores)) {
      expect(score).toBe(100);
    }
  });

  it("produces the exact same score for the exact same input, every time", () => {
    const site = buildSite(
      [buildPage({ statusCode: 404 }), buildPage({ title: undefined })],
      { sitemapUrls: [] },
    );
    const issues = runAudit(site, ALL_RULES);

    const first = computeSearchHealth(site, issues);
    const second = computeSearchHealth(site, issues);

    expect(second).toEqual(first);
  });

  it("scores a CRITICAL issue affecting every page much more harshly than the same issue affecting one of many", () => {
    const smallSite = buildSite([buildPage({ statusCode: 500 })]);
    const bigSitePages = [buildPage({ statusCode: 500 })];
    for (let i = 0; i < 19; i++) bigSitePages.push(buildPage());
    const bigSite = buildSite(bigSitePages);

    const smallScore = computeSearchHealth(smallSite, runAudit(smallSite, ALL_RULES));
    const bigScore = computeSearchHealth(bigSite, runAudit(bigSite, ALL_RULES));

    expect(smallScore.categoryScores.TECHNICAL).toBeLessThan(bigScore.categoryScores.TECHNICAL as number);
  });

  it("never scores a category below 0 even with many severe issues", () => {
    const pages = Array.from({ length: 5 }, () => buildPage({ statusCode: 500 }));
    const site = buildSite(pages);
    const result = computeSearchHealth(site, runAudit(site, ALL_RULES));
    expect(result.categoryScores.TECHNICAL).toBeGreaterThanOrEqual(0);
  });

  it("stamps the explanation with the current scoring version and enough detail to reconstruct the score", () => {
    const site = buildSite([buildPage({ statusCode: 404 })]);
    const result = computeSearchHealth(site, runAudit(site, ALL_RULES));

    expect(result.explanation.scoringVersion).toBe(SCORING_VERSION);
    expect(result.explanation.totalPages).toBe(1);
    expect(result.explanation.overallScore).toBe(result.overallScore);
    expect(result.explanation.categories.length).toBeGreaterThan(0);
    expect(result.explanation.issuePenalties.some((p) => p.ruleKey === "http-4xx-error")).toBe(true);
  });

  it("weighs a low-confidence contextual rule's penalty less than an equally-severe high-confidence one", () => {
    const deterministic = getRuleByKey("http-4xx-error");
    const contextual = getRuleByKey("page-noindexed");
    expect(deterministic).toBeTruthy();
    expect(contextual).toBeTruthy();

    // Both fire on the single page of a 1-page site — isolate the effect of confidence.
    const issue = (rule: NonNullable<typeof deterministic>) => ({
      ruleKey: rule.key,
      rule,
      occurrences: [{ pageId: "p", pageUrl: "u", evidence: {} }],
    });

    const highConfidencePenalty = computePenalty(issue(deterministic!), 1).penalty;
    const lowConfidencePenalty = computePenalty(issue(contextual!), 1).penalty;

    // page-noindexed has lower severity AND lower confidence than http-4xx-error,
    // so its penalty should be substantially smaller per affected page.
    expect(lowConfidencePenalty).toBeLessThan(highConfidencePenalty);
  });

  it("excludes PERFORMANCE from the computed categories when no page has been sampled", () => {
    const site = buildSite([buildPage()]);
    const result = computeSearchHealth(site, runAudit(site, ALL_RULES));
    expect(result.categoryScores.PERFORMANCE).toBeUndefined();
  });

  it("includes PERFORMANCE once at least one page has been sampled, and scores it against the sample size, not total pages", () => {
    const sampled = buildPage({ performance: { status: "COMPLETED", ttfbMs: 100, lcpMs: 5000, cls: 0.05 } });
    const unsampled = Array.from({ length: 9 }, () => buildPage());
    const site = buildSite([sampled, ...unsampled]);

    const result = computeSearchHealth(site, runAudit(site, ALL_RULES));
    expect(result.categoryScores.PERFORMANCE).toBeDefined();
    // poor-lcp fires on the 1 sampled page out of a 1-page sample (100%
    // affectedRatio), not 1 out of 10 crawled pages — a much harsher score
    // than diluting against the full crawl would produce.
    expect(result.categoryScores.PERFORMANCE as number).toBeLessThan(100);
  });
});
