import { describe, expect, it } from "vitest";
import { internalLinkingRules } from "./internal-linking";
import { buildPage, buildSite } from "../fixtures/page-builder";

function ruleByKey(key: string) {
  const rule = internalLinkingRules.find((r) => r.key === key);
  if (!rule) throw new Error(`rule not found: ${key}`);
  return rule;
}

describe("broken-internal-link", () => {
  const rule = ruleByKey("broken-internal-link");

  it("fires when a link points to a page that 404s", () => {
    const broken = buildPage({ id: "broken", statusCode: 404 });
    const source = buildPage({
      outboundLinks: [{ targetUrl: broken.url, isInternal: true, targetPageId: broken.id, anchorText: "Broken" }],
    });
    const site = buildSite([source, broken]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a link to a healthy page", () => {
    const healthy = buildPage({ id: "healthy", statusCode: 200 });
    const source = buildPage({
      outboundLinks: [{ targetUrl: healthy.url, isInternal: true, targetPageId: healthy.id, anchorText: "OK" }],
    });
    const site = buildSite([source, healthy]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("ignores external links entirely", () => {
    const source = buildPage({
      outboundLinks: [{ targetUrl: "https://other.com", isInternal: false, targetPageId: undefined, anchorText: "Ext" }],
    });
    const site = buildSite([source]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("internal-link-to-redirect", () => {
  const rule = ruleByKey("internal-link-to-redirect");

  it("fires when the link target itself required a redirect", () => {
    const target = buildPage({ id: "target", redirectChain: ["https://example.com/old"] });
    const source = buildPage({
      outboundLinks: [{ targetUrl: target.url, isInternal: true, targetPageId: target.id, anchorText: "Go" }],
    });
    const site = buildSite([source, target]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when the target had no redirect", () => {
    const target = buildPage({ id: "target", redirectChain: [] });
    const source = buildPage({
      outboundLinks: [{ targetUrl: target.url, isInternal: true, targetPageId: target.id, anchorText: "Go" }],
    });
    const site = buildSite([source, target]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("orphan-page", () => {
  const rule = ruleByKey("orphan-page");

  it("fires for a non-start page with no inbound internal links", () => {
    const orphan = buildPage({ id: "orphan", depth: 1 });
    const start = buildPage({ id: "start", depth: 0, outboundLinks: [] });
    const site = buildSite([start, orphan]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a page that is linked to", () => {
    const linked = buildPage({ id: "linked", depth: 1 });
    const start = buildPage({
      id: "start",
      depth: 0,
      outboundLinks: [{ targetUrl: linked.url, isInternal: true, targetPageId: linked.id, anchorText: "Go" }],
    });
    const site = buildSite([start, linked]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("never flags the crawl's own start page", () => {
    const start = buildPage({ id: "start", depth: 0 });
    const other = buildPage({
      id: "other",
      depth: 1,
      outboundLinks: [{ targetUrl: start.url, isInternal: true, targetPageId: start.id, anchorText: "Home" }],
    });
    const site = buildSite([start, other]);
    const results = rule.evaluate(site);
    expect(results.some((r) => r.pageId === "start")).toBe(false);
  });
});
