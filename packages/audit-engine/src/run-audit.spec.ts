import { describe, expect, it } from "vitest";
import { runAudit } from "./run-audit";
import { buildPage, buildSite } from "./fixtures/page-builder";
import { ALL_RULES } from "./rule-registry";

describe("runAudit (deterministic fixture site — Phase 07 gate)", () => {
  it("produces exactly the expected issues for a small site with known, deliberate defects", () => {
    // A 4-page fixture site with specific, deliberate problems planted on
    // specific pages, and nothing else wrong — the same "known fixture"
    // discipline as the crawler's Phase 05 gate test.
    const home = buildPage({
      id: "home",
      url: "https://example.com/",
      depth: 0,
      title: "Example Site — Home",
      canonicalUrl: "https://example.com/",
      outboundLinks: [
        { targetUrl: "https://example.com/about", isInternal: true, targetPageId: "about", anchorText: "About" },
        { targetUrl: "https://example.com/broken", isInternal: true, targetPageId: "broken", anchorText: "Broken" },
      ],
    });

    const about = buildPage({
      id: "about",
      url: "https://example.com/about",
      depth: 1,
      title: "Example Site — Home", // deliberate: duplicate of home's title
      canonicalUrl: "https://example.com/about",
    });

    const broken = buildPage({
      id: "broken",
      url: "https://example.com/broken",
      depth: 1,
      statusCode: 404,
      title: undefined,
    });

    // An orphan: reachable only because it's in our page list, not linked
    // to by anything (depth > 0, nothing points at it).
    const orphan = buildPage({
      id: "orphan",
      url: "https://example.com/orphan",
      depth: 1,
      title: "Orphan Page",
      headings: [], // deliberate: no H1
      images: [{ src: "/no-alt.png", hasAlt: false, altText: undefined }],
    });

    const site = buildSite([home, about, broken, orphan], { sitemapUrls: [] });

    const issues = runAudit(site, ALL_RULES);
    const issueByKey = new Map(issues.map((i) => [i.ruleKey, i]));

    // Planted defects, each expected to fire exactly on the pages we put them on.
    expect(issueByKey.get("http-4xx-error")?.occurrences.map((o) => o.pageId)).toEqual(["broken"]);
    expect(issueByKey.get("broken-internal-link")?.occurrences.map((o) => o.pageId)).toEqual(["home"]);
    // missing-title only applies to pages that were actually fetched
    // successfully — a 404 page having no title isn't a separate defect.
    expect(issueByKey.has("missing-title")).toBe(false);
    expect(new Set(issueByKey.get("duplicate-title")?.occurrences.map((o) => o.pageId))).toEqual(
      new Set(["home", "about"]),
    );
    expect(issueByKey.get("missing-h1")?.occurrences.map((o) => o.pageId)).toEqual(["orphan"]);
    expect(issueByKey.get("missing-alt-text")?.occurrences.map((o) => o.pageId)).toEqual(["orphan"]);
    expect(issueByKey.get("orphan-page")?.occurrences.map((o) => o.pageId)).toEqual(["orphan"]);
    expect(issueByKey.get("sitemap-not-found")?.occurrences.map((o) => o.pageId)).toEqual(["home"]);

    // Clean, unremarkable rules that must NOT fire on this fixture.
    expect(issueByKey.has("http-5xx-error")).toBe(false);
    expect(issueByKey.has("non-https-page")).toBe(false);
    expect(issueByKey.has("mixed-content")).toBe(false);
    expect(issueByKey.has("invalid-structured-data")).toBe(false);
    expect(issueByKey.has("conflicting-indexability-signals")).toBe(false);
  });

  it("produces no issues at all for a clean fixture site", () => {
    const home = buildPage({ id: "home", url: "https://example.com/", depth: 0, canonicalUrl: "https://example.com/" });
    const site = buildSite([home], { sitemapUrls: ["https://example.com/sitemap.xml"] });

    const issues = runAudit(site, ALL_RULES);
    expect(issues).toEqual([]);
  });

  it("omits a rule from the results entirely when it finds nothing, rather than an empty issue", () => {
    const site = buildSite([buildPage()], { sitemapUrls: ["https://example.com/sitemap.xml"] });
    const issues = runAudit(site, ALL_RULES);
    expect(issues.every((issue) => issue.occurrences.length > 0)).toBe(true);
  });

  it("runs only the rules it's given when a subset is passed explicitly", () => {
    const site = buildSite([buildPage({ title: undefined })]);
    const onlyTitleRule = ALL_RULES.filter((r) => r.key === "missing-title");
    const issues = runAudit(site, onlyTitleRule);
    expect(issues.map((i) => i.ruleKey)).toEqual(["missing-title"]);
  });
});
