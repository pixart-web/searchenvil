import { describe, expect, it } from "vitest";
import { isSameOrigin, isValidHttpUrl, normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("lowercases the host", () => {
    expect(normalizeUrl("https://Example.COM/path")).toBe("https://example.com/path");
  });

  it("strips the fragment", () => {
    expect(normalizeUrl("https://example.com/path#section")).toBe("https://example.com/path");
  });

  it("removes default ports", () => {
    expect(normalizeUrl("https://example.com:443/path")).toBe("https://example.com/path");
    expect(normalizeUrl("http://example.com:80/path")).toBe("http://example.com/path");
  });

  it("keeps non-default ports", () => {
    expect(normalizeUrl("https://example.com:8443/path")).toBe("https://example.com:8443/path");
  });

  it("removes a trailing slash except on the root path", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe("https://example.com/path");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("sorts query parameters for stable deduplication", () => {
    expect(normalizeUrl("https://example.com/path?b=2&a=1")).toBe(
      "https://example.com/path?a=1&b=2",
    );
  });

  it("resolves a relative URL against a base", () => {
    expect(normalizeUrl("/about", "https://example.com")).toBe("https://example.com/about");
  });
});

describe("isSameOrigin", () => {
  it("returns true for identical origins with different paths", () => {
    expect(isSameOrigin("https://example.com/a", "https://example.com/b")).toBe(true);
  });

  it("returns false across different hosts", () => {
    expect(isSameOrigin("https://example.com", "https://other.com")).toBe(false);
  });

  it("returns false for malformed input instead of throwing", () => {
    expect(isSameOrigin("not a url", "https://example.com")).toBe(false);
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("https://example.com")).toBe(true);
  });

  it("rejects other schemes", () => {
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidHttpUrl("not a url")).toBe(false);
  });
});
