import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Corp")).toBe("acme-corp");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Müller")).toBe("cafe-muller");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("Foo & Bar!! Baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -Acme-  ")).toBe("acme");
  });

  it("caps length at 60 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(60);
  });
});
