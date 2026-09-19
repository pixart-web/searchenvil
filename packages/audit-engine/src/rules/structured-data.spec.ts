import { describe, expect, it } from "vitest";
import { structuredDataRules } from "./structured-data";
import { buildPage, buildSite } from "../fixtures/page-builder";

describe("invalid-structured-data", () => {
  const rule = structuredDataRules[0]!;

  it("fires for a malformed structured data block", () => {
    const site = buildSite([
      buildPage({
        structuredData: [{ format: "json-ld", schemaType: undefined, isValid: false, errors: ["Unexpected token"] }],
      }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(1);
  });

  it("does not fire for valid structured data", () => {
    const site = buildSite([
      buildPage({
        structuredData: [{ format: "json-ld", schemaType: "Article", isValid: true, errors: undefined }],
      }),
    ]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });

  it("does not fire when there is no structured data at all", () => {
    const site = buildSite([buildPage({ structuredData: [] })]);
    expect(rule.evaluate(site)).toHaveLength(0);
  });
});
