import * as cheerio from "cheerio";

export interface SitemapEntry {
  url: string;
  lastModified?: string;
}

export interface ParsedSitemap {
  /** Present when this is a sitemap index rather than a leaf urlset. */
  childSitemaps: string[];
  urls: SitemapEntry[];
}

/**
 * Parses either a <urlset> (leaf sitemap) or <sitemapindex> (index of other
 * sitemaps) — XML sitemap protocol, https://www.sitemaps.org/protocol.html.
 * Pure parsing only; fetching child sitemaps is the caller's job.
 */
export function parseSitemapXml(xml: string): ParsedSitemap {
  const $ = cheerio.load(xml, { xmlMode: true });

  const childSitemaps: string[] = [];
  $("sitemapindex > sitemap > loc").each((_, el) => {
    const text = $(el).text().trim();
    if (text) childSitemaps.push(text);
  });

  const urls: SitemapEntry[] = [];
  $("urlset > url").each((_, el) => {
    const loc = $(el).find("> loc").text().trim();
    if (!loc) return;
    const lastmod = $(el).find("> lastmod").text().trim();
    urls.push({ url: loc, lastModified: lastmod || undefined });
  });

  return { childSitemaps, urls };
}
