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
