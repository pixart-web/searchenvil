import { describe, expect, it } from "vitest";
import { indexabilityRules } from "./indexability";
import { buildPage, buildSite } from "../fixtures/page-builder";

function ruleByKey(key: string) {
  const rule = indexabilityRules.find((r) => r.key === key);
  if (!rule) throw new Error(`rule not found: ${key}`);
  return rule;
}

describe("page-noindexed", () => {
  const rule = ruleByKey("page-noindexed");

  it("fires when isIndexable is false", () => {
    const site = buildSite([buildPage({ isIndexable: false, metaRobots: "noindex" })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for an indexable page", () => {
    const site = buildSite([buildPage({ isIndexable: true })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("conflicting-indexability-signals", () => {
  const rule = ruleByKey("conflicting-indexability-signals");

  it("fires when meta robots and X-Robots-Tag disagree", () => {
    const site = buildSite([buildPage({ metaRobots: "noindex", xRobotsTag: undefined })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when both agree (both noindex)", () => {
    const site = buildSite([buildPage({ metaRobots: "noindex", xRobotsTag: "noindex" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not fire when both agree (neither noindex)", () => {
    const site = buildSite([buildPage({ metaRobots: undefined, xRobotsTag: undefined })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("missing-canonical", () => {
  const rule = ruleByKey("missing-canonical");

  it("fires for a successful page with no canonical", () => {
    const site = buildSite([buildPage({ canonicalUrl: undefined })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when a canonical is present", () => {
    const site = buildSite([buildPage({ canonicalUrl: "https://example.com/page-1" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("invalid-canonical-url", () => {
  const rule = ruleByKey("invalid-canonical-url");

  it("fires for a malformed canonical", () => {
    const site = buildSite([buildPage({ canonicalUrl: "not a url" })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a well-formed absolute canonical", () => {
    const site = buildSite([buildPage({ canonicalUrl: "https://example.com/page" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("canonical-points-to-non-200", () => {
  const rule = ruleByKey("canonical-points-to-non-200");

  it("fires when the canonical target (present in this crawl) is not 200", () => {
    const target = buildPage({ url: "https://example.com/target", statusCode: 404 });
    const source = buildPage({ canonicalUrl: "https://example.com/target" });
    const site = buildSite([source, target]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when the canonical target is 200", () => {
    const target = buildPage({ url: "https://example.com/target", statusCode: 200 });
    const source = buildPage({ canonicalUrl: "https://example.com/target" });
    const site = buildSite([source, target]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not fire when the canonical target wasn't part of this crawl", () => {
    const source = buildPage({ canonicalUrl: "https://example.com/not-crawled" });
    const site = buildSite([source]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("sitemap-contains-non-indexable-url", () => {
  const rule = ruleByKey("sitemap-contains-non-indexable-url");

  it("fires for a sitemap URL that is noindex", () => {
    const page = buildPage({ url: "https://example.com/noindexed", isIndexable: false });
    const site = buildSite([page], { sitemapUrls: ["https://example.com/noindexed"] });
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for an indexable sitemap URL", () => {
    const page = buildPage({ url: "https://example.com/fine", isIndexable: true });
    const site = buildSite([page], { sitemapUrls: ["https://example.com/fine"] });
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});
