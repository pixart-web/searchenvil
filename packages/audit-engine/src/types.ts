export const ISSUE_CATEGORIES = [
  "TECHNICAL",
  "INDEXABILITY",
  "CONTENT",
  "PERFORMANCE",
  "INTERNAL_LINKING",
  "STRUCTURED_DATA",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOTICE"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const EFFORT_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export interface HeadingInput {
  level: number;
  text: string;
}

export interface ImageInput {
  src: string;
  hasAlt: boolean;
  altText: string | undefined;
}

export interface StructuredDataInput {
  format: string;
  schemaType: string | undefined;
  isValid: boolean;
  errors: string[] | undefined;
}

export interface LinkInput {
  targetUrl: string;
  isInternal: boolean;
  /** Set when the target resolved to another page in this same crawl. */
  targetPageId: string | undefined;
  anchorText: string;
}

/**
 * What the audit engine needs to know about one crawled page. Deliberately
 * its own shape (not a re-export of a Prisma type) so this package stays
 * decoupled from how facts are stored — see docs/ARCHITECTURE.md
 * ("Crawler ≠ Audit Engine"). The worker maps CrawlPage rows into this.
 */
export interface PageInput {
  id: string;
  url: string;
  statusCode: number | undefined;
  contentType: string | undefined;
  title: string | undefined;
  metaDescription: string | undefined;
  headings: HeadingInput[];
  canonicalUrl: string | undefined;
  metaRobots: string | undefined;
  xRobotsTag: string | undefined;
  language: string | undefined;
  wordCount: number | undefined;
  isIndexable: boolean;
  depth: number;
  fetchError: string | undefined;
  redirectChain: string[];
  images: ImageInput[];
  structuredData: StructuredDataInput[];
  outboundLinks: LinkInput[];
}

export interface SiteInput {
  pages: PageInput[];
  sitemapUrls: string[];
  robotsTxtFound: boolean;
}

/** One rule firing on one page. Aggregated into an AuditIssue per rule by runAudit(). */
export interface Occurrence {
  pageId: string;
  pageUrl: string;
  evidence: Record<string, unknown>;
}

export interface AuditRuleDefinition {
  key: string;
  version: number;
  name: string;
  category: IssueCategory;
  defaultSeverity: IssueSeverity;
  defaultEffort: EffortLevel;
  /** Relative weight in Search Health scoring (Phase 08) — higher matters more. */
  weight: number;
  description: string;
  whyItMatters: string;
  recommendation: string;
  evaluate: (site: SiteInput) => Occurrence[];
}

export interface AuditIssueResult {
  ruleKey: string;
  rule: AuditRuleDefinition;
  occurrences: Occurrence[];
}
