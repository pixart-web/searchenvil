/**
 * Facts only — no SEO interpretation lives in this package. A rule like
 * "missing title is bad" belongs to @searchanvil/audit-engine, which
 * consumes these shapes. See docs/ARCHITECTURE.md ("Crawler ≠ Audit Engine").
 */

export interface HeadingFact {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface LinkFact {
  href: string;
  resolvedUrl: string | undefined;
  isInternal: boolean;
  anchorText: string;
  rel: string | undefined;
}

export interface ImageFact {
  src: string;
  altText: string | undefined;
  hasAlt: boolean;
}

export interface StructuredDataFact {
  format: "json-ld";
  schemaType: string | undefined;
  raw: unknown;
  isValid: boolean;
  errors: string[] | undefined;
}

export interface OpenGraphFact {
  property: string;
  content: string;
}

export interface PageFacts {
  title: string | undefined;
  metaDescription: string | undefined;
  /** All headings, levels 1–6, in document order — includes H1s (there may be zero, one, or several). */
  headings: HeadingFact[];
  canonicalUrl: string | undefined;
  metaRobots: string | undefined;
  language: string | undefined;
  wordCount: number;
  links: LinkFact[];
  images: ImageFact[];
  structuredData: StructuredDataFact[];
  openGraph: OpenGraphFact[];
}

export interface FetchResult {
  requestedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  statusCode: number | undefined;
  contentType: string | undefined;
  xRobotsTag: string | undefined;
  responseTimeMs: number;
  htmlSizeBytes: number | undefined;
  body: string | undefined;
  fetchError: string | undefined;
}

export interface CrawlPageResult extends FetchResult {
  normalizedUrl: string;
  depth: number;
  facts: PageFacts | undefined;
}

export interface CrawlConfig {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  userAgent: string;
  requestTimeoutMs: number;
  respectRobotsTxt: boolean;
}

export const DEFAULT_CRAWL_CONFIG: Omit<CrawlConfig, "startUrl"> = {
  maxPages: 200,
  maxDepth: 5,
  concurrency: 5,
  userAgent: "SearchAnvilBot/0.1 (+https://searchanvil.com/bot)",
  requestTimeoutMs: 15_000,
  respectRobotsTxt: true,
};

export interface CrawlResult {
  pages: CrawlPageResult[];
  sitemapUrls: string[];
  robotsTxtFound: boolean;
}
