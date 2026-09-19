import { describe, expect, it } from "vitest";
import { formatCategoryLabel, formatRelativeTime } from "./format";

describe("formatCategoryLabel", () => {
  it("title-cases a single word", () => {
    expect(formatCategoryLabel("TECHNICAL")).toBe("Technical");
  });

  it("splits underscores into separate title-cased words", () => {
    expect(formatCategoryLabel("INTERNAL_LINKING")).toBe("Internal Linking");
    expect(formatCategoryLabel("STRUCTURED_DATA")).toBe("Structured Data");
  });
});

describe("formatRelativeTime", () => {
  it("returns an em dash for null", () => {
    expect(formatRelativeTime(null)).toBe("—");
  });

  it("returns 'just now' for the current moment", () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe("just now");
  });

  it("formats minutes ago", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    expect(formatRelativeTime(tenMinutesAgo)).toBe("10m ago");
  });

  it("formats hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("formats days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe("2d ago");
  });
});
