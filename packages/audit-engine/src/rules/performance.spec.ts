import { describe, expect, it } from "vitest";
import { performanceRules } from "./performance";
import { buildPage, buildSite } from "../fixtures/page-builder";

function ruleByKey(key: string) {
  const rule = performanceRules.find((r) => r.key === key);
  if (!rule) throw new Error(`rule not found: ${key}`);
  return rule;
}

describe("poor-lcp", () => {
  const rule = ruleByKey("poor-lcp");

  it("fires when LCP exceeds the poor threshold", () => {
    const site = buildSite([buildPage({ performance: { status: "COMPLETED", lcpMs: 4500, ttfbMs: 100, cls: 0 } })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a good LCP", () => {
    const site = buildSite([buildPage({ performance: { status: "COMPLETED", lcpMs: 1500, ttfbMs: 100, cls: 0 } })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not fire when performance was not sampled", () => {
    const site = buildSite([buildPage({ performance: undefined })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not fire when the analysis failed (no data to judge)", () => {
    const site = buildSite([buildPage({ performance: { status: "FAILED", errorMessage: "timeout" } as never })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("high-cls", () => {
  const rule = ruleByKey("high-cls");

  it("fires when CLS exceeds the poor threshold", () => {
    const site = buildSite([buildPage({ performance: { status: "COMPLETED", cls: 0.4, ttfbMs: 100, lcpMs: 1000 } })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a good CLS", () => {
    const site = buildSite([buildPage({ performance: { status: "COMPLETED", cls: 0.02, ttfbMs: 100, lcpMs: 1000 } })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("slow-ttfb", () => {
  const rule = ruleByKey("slow-ttfb");

  it("fires for a slow first byte", () => {
    const site = buildSite([buildPage({ performance: { status: "COMPLETED", ttfbMs: 1200, lcpMs: 1000, cls: 0 } })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a fast first byte", () => {
    const site = buildSite([buildPage({ performance: { status: "COMPLETED", ttfbMs: 150, lcpMs: 1000, cls: 0 } })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("performance-analysis-failed", () => {
  const rule = ruleByKey("performance-analysis-failed");

  it("fires when a sampled page's analysis failed", () => {
    const site = buildSite([buildPage({ performance: { status: "FAILED", errorMessage: "timeout" } as never })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a completed analysis, however poor its metrics", () => {
    const site = buildSite([buildPage({ performance: { status: "COMPLETED", lcpMs: 9999, ttfbMs: 9999, cls: 1 } })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not fire for an unsampled page", () => {
    const site = buildSite([buildPage({ performance: undefined })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});
