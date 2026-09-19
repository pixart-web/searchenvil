import { describe, expect, it } from "vitest";
import { ALL_RULES, getRuleByKey, RULESET_VERSION } from "./rule-registry";

describe("rule registry", () => {
  it("has between 25 and 35 rules, per the build spec's target range", () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(25);
    expect(ALL_RULES.length).toBeLessThanOrEqual(35);
  });

  it("has no duplicate rule keys", () => {
    const keys = ALL_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every rule a non-empty description, whyItMatters, and recommendation", () => {
    for (const rule of ALL_RULES) {
      expect(rule.description.length, `${rule.key} description`).toBeGreaterThan(0);
      expect(rule.whyItMatters.length, `${rule.key} whyItMatters`).toBeGreaterThan(0);
      expect(rule.recommendation.length, `${rule.key} recommendation`).toBeGreaterThan(0);
    }
  });

  it("resolves a known rule by key", () => {
    expect(getRuleByKey("missing-title")?.category).toBe("CONTENT");
  });

  it("returns undefined for an unknown key", () => {
    expect(getRuleByKey("not-a-real-rule")).toBeUndefined();
  });

  it("exposes a stable ruleset version string", () => {
    expect(RULESET_VERSION).toMatch(/^\d{4}\.\d+$/);
  });

  it("covers every declared issue category with at least one rule", () => {
    const categories = new Set(ALL_RULES.map((r) => r.category));
    expect(categories).toEqual(
      new Set(["TECHNICAL", "INDEXABILITY", "CONTENT", "INTERNAL_LINKING", "STRUCTURED_DATA", "PERFORMANCE"]),
    );
  });
});
