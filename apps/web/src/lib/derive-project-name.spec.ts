import { describe, expect, it } from "vitest";
import { deriveDefaultName } from "./derive-project-name";

describe("deriveDefaultName", () => {
  it("extracts the hostname", () => {
    expect(deriveDefaultName("https://example.com/path")).toBe("example.com");
  });

  it("strips a leading www.", () => {
    expect(deriveDefaultName("https://www.example.com")).toBe("example.com");
  });

  it("returns an empty string for an invalid URL", () => {
    expect(deriveDefaultName("not a url")).toBe("");
  });
});
