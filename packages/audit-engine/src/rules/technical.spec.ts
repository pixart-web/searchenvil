import { describe, expect, it } from "vitest";
import { technicalRules } from "./technical";
import { buildPage, buildSite } from "../fixtures/page-builder";

function ruleByKey(key: string) {
  const rule = technicalRules.find((r) => r.key === key);
  if (!rule) throw new Error(`rule not found: ${key}`);
  return rule;
}

describe("http-5xx-error", () => {
  const rule = ruleByKey("http-5xx-error");

  it("fires for a 500 page", () => {
    const site = buildSite([buildPage({ statusCode: 500 })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a 200 page", () => {
    const site = buildSite([buildPage({ statusCode: 200 })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("http-4xx-error", () => {
  const rule = ruleByKey("http-4xx-error");

  it("fires for a 404 page", () => {
    const site = buildSite([buildPage({ statusCode: 404 })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a 500 (that's the other rule's job)", () => {
    const site = buildSite([buildPage({ statusCode: 500 })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("redirect-chain-too-long", () => {
  const rule = ruleByKey("redirect-chain-too-long");

  it("fires for 2+ redirect hops", () => {
    const site = buildSite([
      buildPage({ redirectChain: ["https://example.com/a", "https://example.com/b"] }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a single redirect", () => {
    const site = buildSite([buildPage({ redirectChain: ["https://example.com/a"] })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not fire with no redirects", () => {
    const site = buildSite([buildPage({ redirectChain: [] })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("missing-h1", () => {
  const rule = ruleByKey("missing-h1");

  it("fires when there is no level-1 heading", () => {
    const site = buildSite([buildPage({ headings: [{ level: 2, text: "Sub" }] })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when an H1 is present", () => {
    const site = buildSite([buildPage({ headings: [{ level: 1, text: "Main" }] })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("ignores non-200 pages", () => {
    const site = buildSite([buildPage({ statusCode: 404, headings: [] })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("multiple-h1", () => {
  const rule = ruleByKey("multiple-h1");

  it("fires for two H1s", () => {
    const site = buildSite([
      buildPage({
        headings: [
          { level: 1, text: "First" },
          { level: 1, text: "Second" },
        ],
      }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for exactly one H1", () => {
    const site = buildSite([buildPage({ headings: [{ level: 1, text: "Only" }] })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("non-https-page", () => {
  const rule = ruleByKey("non-https-page");

  it("fires for an http:// URL", () => {
    const site = buildSite([buildPage({ url: "http://example.com/page" })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for https://", () => {
    const site = buildSite([buildPage({ url: "https://example.com/page" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("mixed-content", () => {
  const rule = ruleByKey("mixed-content");

  it("fires when an https page loads an http image", () => {
    const site = buildSite([
      buildPage({ url: "https://example.com/page", images: [{ src: "http://example.com/a.png", hasAlt: true, altText: "a" }] }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when all resources are https", () => {
    const site = buildSite([
      buildPage({ url: "https://example.com/page", images: [{ src: "https://example.com/a.png", hasAlt: true, altText: "a" }] }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not apply to a page that is itself http", () => {
    const site = buildSite([
      buildPage({ url: "http://example.com/page", images: [{ src: "http://example.com/a.png", hasAlt: true, altText: "a" }] }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("sitemap-not-found", () => {
  const rule = ruleByKey("sitemap-not-found");

  it("fires when no sitemap URLs were discovered", () => {
    const start = buildPage({ depth: 0 });
    const site = buildSite([start], { sitemapUrls: [] });
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when a sitemap was discovered", () => {
    const start = buildPage({ depth: 0 });
    const site = buildSite([start], { sitemapUrls: ["https://example.com/sitemap.xml"] });
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("produces no occurrence when there is no start page to attach it to", () => {
    const site = buildSite([buildPage({ depth: 2 })], { sitemapUrls: [] });
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("sitemap-url-error", () => {
  const rule = ruleByKey("sitemap-url-error");

  it("fires for a sitemap URL that returns an error", () => {
    const page = buildPage({ url: "https://example.com/broken", statusCode: 404 });
    const site = buildSite([page], { sitemapUrls: ["https://example.com/broken"] });
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a sitemap URL that returns 200", () => {
    const page = buildPage({ url: "https://example.com/fine", statusCode: 200 });
    const site = buildSite([page], { sitemapUrls: ["https://example.com/fine"] });
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});
