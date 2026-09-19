import { describe, expect, it } from "vitest";
import { parseSitemapXml } from "./sitemap";

describe("parseSitemapXml", () => {
  it("parses a leaf urlset", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;

    const result = parseSitemapXml(xml);
    expect(result.childSitemaps).toEqual([]);
    expect(result.urls).toEqual([
      { url: "https://example.com/", lastModified: "2026-01-01" },
      { url: "https://example.com/about", lastModified: undefined },
    ]);
  });

  it("parses a sitemap index", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`;

    const result = parseSitemapXml(xml);
    expect(result.childSitemaps).toEqual([
      "https://example.com/sitemap-1.xml",
      "https://example.com/sitemap-2.xml",
    ]);
    expect(result.urls).toEqual([]);
  });

  it("returns empty results for malformed input instead of throwing", () => {
    expect(() => parseSitemapXml("not xml at all")).not.toThrow();
    expect(parseSitemapXml("not xml at all").urls).toEqual([]);
  });
});
