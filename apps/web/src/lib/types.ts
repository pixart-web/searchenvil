export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { sites: number };
}

export interface Site {
  id: string;
  projectId: string;
  displayName: string;
  rootUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NOTICE";
export type EffortLevel = "EASY" | "MEDIUM" | "HARD";
export type ImpactLabel = "HIGH" | "MEDIUM" | "LOW";
export type IssueCategory =
  | "TECHNICAL"
  | "INDEXABILITY"
  | "CONTENT"
  | "PERFORMANCE"
  | "INTERNAL_LINKING"
  | "STRUCTURED_DATA";

export interface TopIssue {
  id: string;
  ruleKey: string;
  title: string;
  severity: IssueSeverity;
  impact: ImpactLabel;
  effort: EffortLevel;
  affectedPageCount: number;
  priorityScore: number;
}

export interface RecentCrawlSummary {
  id: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  pagesCrawled: number;
  overallScore: number | null;
}

export interface LatestCrawlOverview {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  pagesCrawled: number;
  score: {
    overallScore: number;
    categoryScores: Record<string, number>;
  };
  issuesBySeverity: Record<string, number>;
  issuesByCategory: Record<string, number>;
  topIssues: TopIssue[];
}

export interface SiteOverview {
  id: string;
  displayName: string;
  rootUrl: string;
  latestCrawl: LatestCrawlOverview | null;
  recentCrawls: RecentCrawlSummary[];
}

export interface ProjectOverview {
  project: { id: string; name: string };
  sites: SiteOverview[];
}

export interface IssueRule {
  ruleKey: string;
  category: IssueCategory;
  name: string;
  description: string;
  whyItMatters: string;
  recommendation: string;
}

export interface IssueListItem {
  id: string;
  severity: IssueSeverity;
  impact: ImpactLabel;
  effort: EffortLevel;
  affectedPageCount: number;
  title: string;
  summary: string;
  priorityScore: number;
  rule: IssueRule;
}

export interface IssueOccurrence {
  id: string;
  pageId: string;
  evidence: Record<string, unknown>;
  page: {
    id: string;
    normalizedUrl: string;
    title: string | null;
    statusCode: number | null;
  };
}

export interface IssueDetail extends IssueListItem {
  occurrences: IssueOccurrence[];
}

export interface HeadingFact {
  level: number;
  text: string;
}

export interface OpenGraphFact {
  property: string;
  content: string;
}

export interface CrawlPageListItem {
  id: string;
  normalizedUrl: string;
  statusCode: number | null;
  title: string | null;
  isIndexable: boolean;
  wordCount: number | null;
  depth: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CrawlImageFact {
  id: string;
  src: string;
  hasAlt: boolean;
  altText: string | null;
}

export interface CrawlStructuredDataFact {
  id: string;
  format: string;
  schemaType: string | null;
  isValid: boolean;
  errors: string[] | null;
}

export interface CrawlLinkFact {
  id: string;
  targetUrl: string;
  isInternal: boolean;
  anchorText: string | null;
}

export interface PageAffectingIssue {
  id: string;
  ruleKey: string;
  title: string;
  severity: IssueSeverity;
  impact: ImpactLabel;
  evidence: Record<string, unknown>;
}

export interface CrawlPageDetail extends CrawlPageListItem {
  requestedUrl: string;
  finalUrl: string;
  redirectChain: string[] | null;
  contentType: string | null;
  responseTimeMs: number | null;
  htmlSizeBytes: number | null;
  metaDescription: string | null;
  h1: string | null;
  headings: HeadingFact[] | null;
  canonicalUrl: string | null;
  metaRobots: string | null;
  xRobotsTag: string | null;
  language: string | null;
  openGraph: OpenGraphFact[] | null;
  fetchError: string | null;
  images: CrawlImageFact[];
  structuredData: CrawlStructuredDataFact[];
  outboundLinks: CrawlLinkFact[];
  inboundLinkCount: number;
  issues: PageAffectingIssue[];
}

export type PerformanceSampleStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export interface PerformanceSample {
  id: string;
  status: PerformanceSampleStatus;
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadTimeMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  errorMessage: string | null;
  analyzedAt: string | null;
  page: { id: string; normalizedUrl: string; title: string | null };
}

export interface ProjectPerformance {
  crawlId: string | null;
  totalPagesCrawled: number;
  samples: PerformanceSample[];
}

export interface ComparisonIssueSummary {
  ruleKey: string;
  title: string;
  severity: IssueSeverity;
  impact: ImpactLabel;
  affectedPageCount: number;
  priorityScore: number;
}

export interface ComparisonPageDelta {
  url: string;
  baselineIssueCount: number;
  currentIssueCount: number;
}

export interface CrawlComparisonSnapshot {
  crawlId: string;
  finishedAt: string | null;
  overallScore: number;
  categoryScores: Record<string, number>;
}

export interface ReportListItem {
  crawlId: string;
  finishedAt: string | null;
  pagesCrawled: number;
  overallScore: number;
}

export interface ReportIssue {
  ruleKey: string;
  category: IssueCategory;
  title: string;
  summary: string;
  severity: IssueSeverity;
  impact: ImpactLabel;
  effort: EffortLevel;
  affectedPageCount: number;
  priorityScore: number;
  recommendation: string;
}

export interface Report {
  site: { id: string; displayName: string; rootUrl: string };
  crawl: { id: string; startedAt: string | null; finishedAt: string | null; pagesCrawled: number };
  score: { overallScore: number; categoryScores: Record<string, number> };
  previousCrawl: { id: string; finishedAt: string | null; overallScore: number } | null;
  scoreDelta: number | null;
  issues: ReportIssue[];
}

export interface CrawlComparison {
  baseline: CrawlComparisonSnapshot;
  current: CrawlComparisonSnapshot;
  scoreDelta: number;
  categoryDeltas: Record<string, number | null>;
  issues: {
    new: ComparisonIssueSummary[];
    resolved: ComparisonIssueSummary[];
    persisting: ComparisonIssueSummary[];
  };
  pages: {
    matchedUrlCount: number;
    newPageCount: number;
    removedPageCount: number;
    improved: ComparisonPageDelta[];
    worsened: ComparisonPageDelta[];
  };
}
