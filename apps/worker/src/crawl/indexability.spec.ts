import { describe, expect, it } from "vitest";
import { computeIsIndexable } from "./indexability";

describe("computeIsIndexable", () => {
  it("is true when neither signal is present", () => {
    expect(computeIsIndexable(undefined, undefined)).toBe(true);
  });

  it("is false when meta robots declares noindex", () => {
    expect(computeIsIndexable("noindex", undefined)).toBe(false);
    expect(computeIsIndexable("noindex, follow", undefined)).toBe(false);
  });

  it("is false when X-Robots-Tag declares noindex", () => {
    expect(computeIsIndexable(undefined, "noindex")).toBe(false);
  });

  it("is true for other robots directives that aren't noindex", () => {
    expect(computeIsIndexable("nofollow", undefined)).toBe(true);
    expect(computeIsIndexable("max-snippet:-1", undefined)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(computeIsIndexable("NOINDEX", undefined)).toBe(false);
  });
});
