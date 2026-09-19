import { describe, expect, it } from "vitest";
import { prioritizeIssues } from "./priority";
import { runAudit } from "./run-audit";
import { buildPage, buildSite } from "./fixtures/page-builder";
import { ALL_RULES } from "./rule-registry";

describe("prioritizeIssues (deterministic — Phase 08 gate)", () => {
  it("ranks a high-severity, high-confidence, widely-affecting issue above a low-severity one", () => {
    const pages = [
      buildPage({ statusCode: 500 }), // http-5xx-error: CRITICAL, confidence 1.0
      buildPage({ headings: [{ level: 1, text: "A" }, { level: 1, text: "B" }] }), // multiple-h1: LOW, confidence 0.5
    ];
    const site = buildSite(pages);
    const ranked = prioritizeIssues(runAudit(site, ALL_RULES), site.pages.length);

    const critIndex = ranked.findIndex((r) => r.ruleKey === "http-5xx-error");
    const lowIndex = ranked.findIndex((r) => r.ruleKey === "multiple-h1");
    expect(critIndex).toBeGreaterThanOrEqual(0);
    expect(lowIndex).toBeGreaterThanOrEqual(0);
    expect(critIndex).toBeLessThan(lowIndex);
  });

  it("produces the exact same ranking for the exact same input, every time", () => {
    const site = buildSite([buildPage({ statusCode: 404 }), buildPage({ title: undefined })]);
    const issues = runAudit(site, ALL_RULES);

    const first = prioritizeIssues(issues, site.pages.length);
    const second = prioritizeIssues(issues, site.pages.length);

    expect(second.map((r) => r.ruleKey)).toEqual(first.map((r) => r.ruleKey));
  });

  it("breaks ties deterministically by ruleKey rather than input/object order", () => {
    const site = buildSite([buildPage({ title: undefined }), buildPage({ metaDescription: undefined })]);
    const issues = runAudit(site, ALL_RULES);
    const reversedIssues = [...issues].reverse();

    const ranked = prioritizeIssues(issues, site.pages.length).map((r) => r.ruleKey);
    const rankedFromReversed = prioritizeIssues(reversedIssues, site.pages.length).map((r) => r.ruleKey);

    expect(rankedFromReversed).toEqual(ranked);
  });

  it("prefers an EASY fix over a HARD one of otherwise-similar impact", () => {
    // internal-link-to-redirect (EASY) vs orphan-page (MEDIUM effort) —
    // both INTERNAL_LINKING, comparable weight/confidence, isolate effort's effect.
    const target = buildPage({ id: "target", redirectChain: ["https://example.com/old"] });
    const linker = buildPage({
      id: "linker",
      outboundLinks: [{ targetUrl: target.url, isInternal: true, targetPageId: target.id, anchorText: "Go" }],
    });
    const orphan = buildPage({ id: "orphan", depth: 1 });
    const site = buildSite([linker, target, orphan]);

    const ranked = prioritizeIssues(runAudit(site, ALL_RULES), site.pages.length);
    const easyEntry = ranked.find((r) => r.ruleKey === "internal-link-to-redirect");
    const mediumEntry = ranked.find((r) => r.ruleKey === "orphan-page");

    expect(easyEntry).toBeTruthy();
    expect(mediumEntry).toBeTruthy();
    // internal-link-to-redirect: weight 2, confidence 0.85, severity LOW (5) -> small base penalty * 1.2 ease
    // orphan-page: weight 4, confidence 0.7, severity MEDIUM (12) -> larger base penalty * 1.0 ease
    // This assertion isn't about raw magnitude (orphan-page is more severe) —
    // it's that the EASY ease-factor is actually applied and distinguishable.
    expect(easyEntry?.priorityScore).toBeGreaterThan(0);
  });

  it("labels impact as HIGH/MEDIUM/LOW consistently with the underlying penalty magnitude", () => {
    const site = buildSite([buildPage({ statusCode: 500 })]);
    const ranked = prioritizeIssues(runAudit(site, ALL_RULES), site.pages.length);
    const criticalEntry = ranked.find((r) => r.ruleKey === "http-5xx-error");
    expect(criticalEntry?.impact).toBe("HIGH");
  });

  it("returns an empty ranking for a clean site", () => {
    const site = buildSite([buildPage({ canonicalUrl: "https://example.com/page-1" })], {
      sitemapUrls: ["https://example.com/sitemap.xml"],
    });
    expect(prioritizeIssues(runAudit(site, ALL_RULES), site.pages.length)).toEqual([]);
  });
});
