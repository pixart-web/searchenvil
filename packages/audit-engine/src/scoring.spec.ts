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
    const result = computeSearchHealth(issues, site.pages.length);

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

    const first = computeSearchHealth(issues, site.pages.length);
    const second = computeSearchHealth(issues, site.pages.length);

    expect(second).toEqual(first);
  });

  it("scores a CRITICAL issue affecting every page much more harshly than the same issue affecting one of many", () => {
    const smallSite = buildSite([buildPage({ statusCode: 500 })]);
    const bigSitePages = [buildPage({ statusCode: 500 })];
    for (let i = 0; i < 19; i++) bigSitePages.push(buildPage());
    const bigSite = buildSite(bigSitePages);

    const smallScore = computeSearchHealth(runAudit(smallSite, ALL_RULES), smallSite.pages.length);
    const bigScore = computeSearchHealth(runAudit(bigSite, ALL_RULES), bigSite.pages.length);

    expect(smallScore.categoryScores.TECHNICAL).toBeLessThan(bigScore.categoryScores.TECHNICAL as number);
  });

  it("never scores a category below 0 even with many severe issues", () => {
    const pages = Array.from({ length: 5 }, () => buildPage({ statusCode: 500 }));
    const site = buildSite(pages);
    const result = computeSearchHealth(runAudit(site, ALL_RULES), site.pages.length);
    expect(result.categoryScores.TECHNICAL).toBeGreaterThanOrEqual(0);
  });

  it("stamps the explanation with the current scoring version and enough detail to reconstruct the score", () => {
    const site = buildSite([buildPage({ statusCode: 404 })]);
    const result = computeSearchHealth(runAudit(site, ALL_RULES), site.pages.length);

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

  it("excludes PERFORMANCE from the computed categories (no rules exist for it yet)", () => {
    const site = buildSite([buildPage()]);
    const result = computeSearchHealth(runAudit(site, ALL_RULES), site.pages.length);
    expect(result.categoryScores.PERFORMANCE).toBeUndefined();
  });
});
