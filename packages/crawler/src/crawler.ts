import type { Agent } from "undici";
import { isValidHttpUrl, normalizeUrl } from "@searchanvil/shared";
import { ConcurrencyPool } from "./concurrency-pool";
import { safeFetch } from "./fetcher";
import { extractPageFacts } from "./parser";
import { EMPTY_ROBOTS, isAllowedByRobots, parseRobotsTxt, type RobotsTxt } from "./robots";
import { parseSitemapXml } from "./sitemap";
import type { CrawlConfig, CrawlPageResult, CrawlResult } from "./types";

interface QueueItem {
  url: string;
  depth: number;
}

function isHtmlContentType(contentType: string | undefined): boolean {
  return !contentType || contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

// Bounded sitemap discovery safety limits (SA-RC21 finding #3) — deliberately not part of
// CrawlConfig: these guard against a hostile or misconfigured sitemap turning discovery into an
// unbounded fetch storm, independent of whatever maxPages the caller chose for actual crawling.
/** Total number of sitemap files (index + leaf) fetched across one crawl's discovery pass. */
const MAX_SITEMAP_FILES = 25;
/** How many levels of <sitemapindex> nesting are followed (an index pointing at an index...). */
const MAX_SITEMAP_INDEX_DEPTH = 3;
/** Total distinct page URLs accepted from sitemap discovery, regardless of maxPages. */
const MAX_SITEMAP_URLS = 5000;

async function discoverRobots(
  origin: string,
  config: CrawlConfig,
  dispatcher: Agent | undefined,
  signal: AbortSignal | undefined,
): Promise<{ robots: RobotsTxt; found: boolean }> {
  const result = await safeFetch(new URL("/robots.txt", origin).toString(), {
    userAgent: config.userAgent,
    timeoutMs: config.requestTimeoutMs,
    dispatcher,
    signal,
  });
  if (result.statusCode !== 200 || !result.body) {
    return { robots: EMPTY_ROBOTS, found: false };
  }
  return { robots: parseRobotsTxt(result.body, config.userAgent), found: true };
}

/**
 * Recursively discovers page URLs from a site's sitemap(s), starting from
 * whatever robots.txt declares (or the conventional /sitemap.xml if it
 * declares nothing), walking <sitemapindex> nesting up to
 * MAX_SITEMAP_INDEX_DEPTH deep. Bounded by MAX_SITEMAP_FILES (total sitemap
 * fetches, index + leaf combined) and MAX_SITEMAP_URLS (total page URLs
 * accepted) so a hostile or absurdly large sitemap can't turn discovery
 * into an unbounded fetch storm.
 *
 * Same-origin only: a sitemap can declare a child sitemap or a page URL on
 * any origin it likes, but only same-origin ones are ever fetched or
 * accepted here — a sitemap must never become a way to make this crawler
 * touch a foreign origin (SA-RC21 finding #3's explicit safety requirement).
 * Every accepted URL still goes through the same safeFetch/SSRF path as any
 * other crawl target once it's actually requested — this function only
 * decides what's a *candidate*, never fetches page content itself.
 */
async function discoverSitemapUrls(
  origin: string,
  robots: RobotsTxt,
  config: CrawlConfig,
  dispatcher: Agent | undefined,
  signal: AbortSignal | undefined,
): Promise<string[]> {
  const initialCandidates =
    robots.sitemaps.length > 0 ? robots.sitemaps : [new URL("/sitemap.xml", origin).toString()];

  const isSameOrigin = (url: string): boolean => {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  };

  const discoveredPageUrls = new Set<string>();
  const visitedSitemaps = new Set<string>();
  let sitemapFilesFetched = 0;
  const queue: { url: string; depth: number }[] = initialCandidates
    .filter(isSameOrigin)
    .map((url) => ({ url, depth: 0 }));

  while (queue.length > 0 && sitemapFilesFetched < MAX_SITEMAP_FILES && discoveredPageUrls.size < MAX_SITEMAP_URLS) {
    const { url: sitemapUrl, depth } = queue.shift()!;
    if (visitedSitemaps.has(sitemapUrl) || signal?.aborted) continue;
    visitedSitemaps.add(sitemapUrl);
    sitemapFilesFetched++;

    const result = await safeFetch(sitemapUrl, {
      userAgent: config.userAgent,
      timeoutMs: config.requestTimeoutMs,
      dispatcher,
      signal,
    });
    if (result.statusCode !== 200 || !result.body) continue;

    // parseSitemapXml is lenient (cheerio in XML mode) — a malformed document simply yields no
    // urls/childSitemaps rather than throwing, so a broken sitemap degrades to "nothing
    // discovered here," not a crawl-ending exception.
    const parsed = parseSitemapXml(result.body);

    for (const entry of parsed.urls) {
      if (discoveredPageUrls.size >= MAX_SITEMAP_URLS) break;
      if (isSameOrigin(entry.url)) discoveredPageUrls.add(entry.url);
    }

    if (depth < MAX_SITEMAP_INDEX_DEPTH) {
      for (const childUrl of parsed.childSitemaps) {
        if (isSameOrigin(childUrl) && !visitedSitemaps.has(childUrl)) {
          queue.push({ url: childUrl, depth: depth + 1 });
        }
      }
    }
  }

  return [...discoveredPageUrls];
}

export interface RunCrawlOptions {
  /** Never set by production code paths other than a caller wanting to point at a fixture server. See fetcher.ts FetchOptions.dispatcher. */
  dispatcher?: Agent;
  /**
   * Propagated all the way to undici's request() call (via safeFetch) — aborting stops new
   * fetches from starting AND aborts any in-flight HTTP request immediately (SA-RC21 finding #4).
   */
  signal?: AbortSignal;
  /** Called synchronously as each page finishes, for progress reporting/persistence. */
  onPageCrawled?: (page: CrawlPageResult) => void;
}

export async function runCrawl(
  config: CrawlConfig,
  options: RunCrawlOptions = {},
): Promise<CrawlResult> {
  const startUrl = normalizeUrl(config.startUrl);
  const origin = new URL(startUrl).origin;

  const { robots, found: robotsTxtFound } = await discoverRobots(
    origin,
    config,
    options.dispatcher,
    options.signal,
  );
  const sitemapUrls = await discoverSitemapUrls(origin, robots, config, options.dispatcher, options.signal);

  const visited = new Set<string>([startUrl]);
  const pages: CrawlPageResult[] = [];
  // Reserved synchronously (before any `await`) the moment a worker picks up an item, not once
  // the fetch completes — with concurrency > 1, checking only `pages.length` lets multiple
  // in-flight workers all pass the check before any of them has pushed a result, overshooting
  // maxPages by up to `concurrency - 1`. `dispatched` closes that race.
  let dispatched = 0;

  const pool = new ConcurrencyPool<QueueItem>(
    config.concurrency,
    async (item, self) => {
      if (dispatched >= config.maxPages) return;
      dispatched++;

      const fetchResult = await safeFetch(item.url, {
        userAgent: config.userAgent,
        timeoutMs: config.requestTimeoutMs,
        dispatcher: options.dispatcher,
        signal: options.signal,
      });

      const facts =
        fetchResult.body && isHtmlContentType(fetchResult.contentType)
          ? extractPageFacts(fetchResult.body, fetchResult.finalUrl)
          : undefined;

      const pageResult: CrawlPageResult = {
        ...fetchResult,
        normalizedUrl: normalizeUrl(item.url),
        depth: item.depth,
        facts,
      };
      pages.push(pageResult);
      options.onPageCrawled?.(pageResult);

      if (!facts || item.depth >= config.maxDepth) return;

      for (const link of facts.links) {
        if (dispatched >= config.maxPages) break;
        if (!link.isInternal || !link.resolvedUrl || !isValidHttpUrl(link.resolvedUrl)) continue;

        const normalized = normalizeUrl(link.resolvedUrl);
        if (visited.has(normalized)) continue;

        if (config.respectRobotsTxt) {
          const target = new URL(normalized);
          if (!isAllowedByRobots(robots, target.pathname + target.search)) continue;
        }

        visited.add(normalized);
        self.enqueue({ url: normalized, depth: item.depth + 1 });
      }
    },
    options.signal,
  );

  const isAllowed = (url: string): boolean => {
    if (!config.respectRobotsTxt) return true;
    const target = new URL(url);
    return isAllowedByRobots(robots, target.pathname + target.search);
  };

  // Sitemap-discovered URLs are seeded as their own crawl candidates, exactly like the start URL
  // — depth 0, not "depth of whatever link found them" — since a sitemap makes no claim about a
  // page's position in the site's link graph. This is what lets an orphan page (present in the
  // sitemap but never internally linked) actually get crawled (SA-RC21 finding #3). Every
  // existing safety rule still applies: same-origin (already enforced inside
  // discoverSitemapUrls), URL validity, robots rules, maxPages/maxDepth (enforced by the pool
  // worker itself), deduplication against `visited`, and the same SSRF-checked safeFetch path
  // once a URL is actually requested.
  const seedItems: QueueItem[] = [];
  if (isValidHttpUrl(startUrl) && isAllowed(startUrl)) {
    seedItems.push({ url: startUrl, depth: 0 });
  }
  for (const sitemapPageUrl of sitemapUrls) {
    if (!isValidHttpUrl(sitemapPageUrl)) continue;
    const normalized = normalizeUrl(sitemapPageUrl);
    if (visited.has(normalized)) continue;
    if (!isAllowed(normalized)) continue;
    visited.add(normalized);
    seedItems.push({ url: normalized, depth: 0 });
  }

  if (seedItems.length > 0) {
    await pool.run(seedItems);
  }

  return { pages, sitemapUrls, robotsTxtFound };
}
