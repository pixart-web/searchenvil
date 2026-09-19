import { describe, expect, it } from "vitest";
import { contentRules } from "./content";
import { buildPage, buildSite } from "../fixtures/page-builder";

function ruleByKey(key: string) {
  const rule = contentRules.find((r) => r.key === key);
  if (!rule) throw new Error(`rule not found: ${key}`);
  return rule;
}

describe("missing-title", () => {
  const rule = ruleByKey("missing-title");

  it("fires when title is absent", () => {
    const site = buildSite([buildPage({ title: undefined })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when a title is present", () => {
    const site = buildSite([buildPage({ title: "Something" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("duplicate-title", () => {
  const rule = ruleByKey("duplicate-title");

  it("fires for two pages sharing a title", () => {
    const site = buildSite([
      buildPage({ title: "Same Title" }),
      buildPage({ title: "Same Title" }),
      buildPage({ title: "Different" }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(2);
  });

  it("does not fire when all titles are unique", () => {
    const site = buildSite([buildPage({ title: "A" }), buildPage({ title: "B" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("title-suspicious-length", () => {
  const rule = ruleByKey("title-suspicious-length");

  it("fires for a very short title", () => {
    const site = buildSite([buildPage({ title: "Hi" })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("fires for a very long title", () => {
    const site = buildSite([buildPage({ title: "A".repeat(90) })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a reasonably-sized title", () => {
    const site = buildSite([buildPage({ title: "A Perfectly Reasonable Page Title" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("missing-meta-description", () => {
  const rule = ruleByKey("missing-meta-description");

  it("fires when absent", () => {
    const site = buildSite([buildPage({ metaDescription: undefined })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when present", () => {
    const site = buildSite([buildPage({ metaDescription: "Present" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("duplicate-meta-description", () => {
  const rule = ruleByKey("duplicate-meta-description");

  it("fires for two pages sharing a description", () => {
    const site = buildSite([
      buildPage({ metaDescription: "Same" }),
      buildPage({ metaDescription: "Same" }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(2);
  });

  it("does not fire for unique descriptions", () => {
    const site = buildSite([buildPage({ metaDescription: "A" }), buildPage({ metaDescription: "B" })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("meta-description-suspicious-length", () => {
  const rule = ruleByKey("meta-description-suspicious-length");

  it("fires for a very short description", () => {
    const site = buildSite([buildPage({ metaDescription: "Too short." })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("fires for a very long description", () => {
    const site = buildSite([buildPage({ metaDescription: "A".repeat(200) })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for a reasonably-sized description", () => {
    const site = buildSite([
      buildPage({
        metaDescription:
          "A meta description of a perfectly reasonable length that sits comfortably within the recommended range.",
      }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("low-word-count", () => {
  const rule = ruleByKey("low-word-count");

  it("fires for thin content", () => {
    const site = buildSite([buildPage({ wordCount: 50 })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for substantial content", () => {
    const site = buildSite([buildPage({ wordCount: 800 })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("duplicate-h1", () => {
  const rule = ruleByKey("duplicate-h1");

  it("fires for two pages sharing an H1", () => {
    const site = buildSite([
      buildPage({ headings: [{ level: 1, text: "Same Heading" }] }),
      buildPage({ headings: [{ level: 1, text: "Same Heading" }] }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(2);
  });

  it("does not fire for unique H1s", () => {
    const site = buildSite([
      buildPage({ headings: [{ level: 1, text: "A" }] }),
      buildPage({ headings: [{ level: 1, text: "B" }] }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});

describe("missing-alt-text", () => {
  const rule = ruleByKey("missing-alt-text");

  it("fires when an image has no alt attribute", () => {
    const site = buildSite([buildPage({ images: [{ src: "/a.png", hasAlt: false, altText: undefined }] })]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire when every image has an alt attribute (even an empty one)", () => {
    const site = buildSite([
      buildPage({
        images: [
          { src: "/a.png", hasAlt: true, altText: "A" },
          { src: "/b.png", hasAlt: true, altText: undefined },
        ],
      }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});
