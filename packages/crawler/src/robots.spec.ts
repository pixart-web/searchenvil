import { describe, expect, it } from "vitest";
import { isAllowedByRobots, parseRobotsTxt } from "./robots";

const SAMPLE = `
User-agent: SearchEnvilBot
Disallow: /private/
Allow: /private/public-page

User-agent: *
Disallow: /admin
Disallow: /search?
Allow: /

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml
`;

describe("parseRobotsTxt", () => {
  it("collects sitemap directives regardless of group", () => {
    const robots = parseRobotsTxt(SAMPLE, "SearchEnvilBot/0.1");
    expect(robots.sitemaps).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/sitemap-news.xml",
    ]);
  });

  it("selects the most specific matching user-agent group", () => {
    const robots = parseRobotsTxt(SAMPLE, "SearchEnvilBot/0.1");
    expect(robots.rules).toEqual([
      { path: "/private/", allow: false },
      { path: "/private/public-page", allow: true },
    ]);
  });

  it("falls back to the wildcard group for an unmatched user-agent", () => {
    const robots = parseRobotsTxt(SAMPLE, "SomeOtherBot/1.0");
    expect(robots.rules).toEqual([
      { path: "/admin", allow: false },
      { path: "/search?", allow: false },
      { path: "/", allow: true },
    ]);
  });

  it("treats an empty Disallow value as allow-all", () => {
    const robots = parseRobotsTxt("User-agent: *\nDisallow:\n", "AnyBot");
    expect(isAllowedByRobots(robots, "/anything")).toBe(true);
  });

  it("ignores comments and blank lines", () => {
    const robots = parseRobotsTxt("# comment\n\nUser-agent: *\n# another comment\nDisallow: /x\n", "AnyBot");
    expect(robots.rules).toEqual([{ path: "/x", allow: false }]);
  });
});

describe("isAllowedByRobots", () => {
  const robots = parseRobotsTxt(SAMPLE, "SomeOtherBot/1.0");

  it("allows a path with no matching disallow rule", () => {
    expect(isAllowedByRobots(robots, "/blog/post-1")).toBe(true);
  });

  it("disallows a path matching a Disallow prefix", () => {
    expect(isAllowedByRobots(robots, "/admin/dashboard")).toBe(false);
  });

  it("lets the longest matching rule win over a shorter conflicting one", () => {
    const bot = parseRobotsTxt(SAMPLE, "SearchEnvilBot/0.1");
    expect(isAllowedByRobots(bot, "/private/secret")).toBe(false);
    expect(isAllowedByRobots(bot, "/private/public-page")).toBe(true);
    expect(isAllowedByRobots(bot, "/private/public-page/extra")).toBe(true);
  });

  it("returns true (allowed) when there are no rules at all", () => {
    const noRules = parseRobotsTxt("", "AnyBot");
    expect(isAllowedByRobots(noRules, "/whatever")).toBe(true);
  });
});
