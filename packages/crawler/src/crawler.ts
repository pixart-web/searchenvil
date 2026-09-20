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

async function discoverRobots(
  origin: string,
  config: CrawlConfig,
  dispatcher: Agent | undefined,
): Promise<{ robots: RobotsTxt; found: boolean }> {
  const result = await safeFetch(new URL("/robots.txt", origin).toString(), {
    userAgent: config.userAgent,
    timeoutMs: config.requestTimeoutMs,
    dispatcher,
  });
  if (result.statusCode !== 200 || !result.body) {
    return { robots: EMPTY_ROBOTS, found: false };
  }
  return { robots: parseRobotsTxt(result.body, config.userAgent), found: true };
}

async function discoverSitemapUrls(
  origin: string,
  robots: RobotsTxt,
  config: CrawlConfig,
  dispatcher: Agent | undefined,
): Promise<string[]> {
  const candidates =
    robots.sitemaps.length > 0 ? robots.sitemaps : [new URL("/sitemap.xml", origin).toString()];

  const discovered = new Set<string>();
  for (const sitemapUrl of candidates.slice(0, 10)) {
    const result = await safeFetch(sitemapUrl, {
      userAgent: config.userAgent,
      timeoutMs: config.requestTimeoutMs,
      dispatcher,
    });
    if (result.statusCode !== 200 || !result.body) continue;
    const parsed = parseSitemapXml(result.body);
    parsed.urls.forEach((entry) => discovered.add(entry.url));
    // Not recursing into child sitemaps in Phase 05 — a sitemap index's
    // children are themselves recorded so a later phase can walk them; the
    // crawl's own traversal always happens via discovered page links.
    parsed.childSitemaps.forEach((childUrl) => discovered.add(childUrl));
  }
  return [...discovered];
}

export interface RunCrawlOptions {
  /** Never set by production code paths other than a caller wanting to point at a fixture server. See fetcher.ts FetchOptions.dispatcher. */
  dispatcher?: Agent;
  /** Aborting stops new fetches from starting; in-flight fetches still complete. */
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

  const { robots, found: robotsTxtFound } = await discoverRobots(origin, config, options.dispatcher);
  const sitemapUrls = await discoverSitemapUrls(origin, robots, config, options.dispatcher);

  const visited = new Set<string>([startUrl]);
  const pages: CrawlPageResult[] = [];

  const pool = new ConcurrencyPool<QueueItem>(
    config.concurrency,
    async (item, self) => {
      if (pages.length >= config.maxPages) return;

      const fetchResult = await safeFetch(item.url, {
        userAgent: config.userAgent,
        timeoutMs: config.requestTimeoutMs,
        dispatcher: options.dispatcher,
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
        if (pages.length >= config.maxPages) break;
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

  const startAllowed =
    !config.respectRobotsTxt ||
    isAllowedByRobots(robots, new URL(startUrl).pathname + new URL(startUrl).search);

  if (startAllowed) {
    await pool.run([{ url: startUrl, depth: 0 }]);
  }

  return { pages, sitemapUrls, robotsTxtFound };
}
