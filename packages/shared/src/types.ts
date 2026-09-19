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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}
