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

export const IMPACT_LABELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ImpactLabel = (typeof IMPACT_LABELS)[number];

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
export interface PagePerformanceInput {
  status: "COMPLETED" | "FAILED";
  ttfbMs: number | undefined;
  lcpMs: number | undefined;
  cls: number | undefined;
}

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
  /** Only present for the small, sampled subset of pages performance analysis actually ran on — see docs/PERFORMANCE.md. Absence means "not sampled," not "fine." */
  performance: PagePerformanceInput | undefined;
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
  /** Relative weight in Search Health scoring — higher matters more. */
  weight: number;
  /**
   * How certain a firing of this rule actually indicates a problem, from 0
   * to 1. Deterministic defects (a 404, malformed JSON) are 1.0.
   * Contextual findings that are often intentional (noindex, missing
   * canonical, thin content) are lower — see docs/SCORING.md and
   * docs/AUDIT_ENGINE.md ("Deterministic vs. contextual"). Used to scale
   * both Search Health penalties and Forge Priority ranking so a
   * low-confidence finding never outweighs a high-confidence one of
   * similar severity.
   */
  confidence: number;
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
