export const QUEUE_NAMES = {
  CRAWL: "crawl",
  AUDIT: "audit",
  PERFORMANCE: "performance",
  REPORT: "report",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface CrawlJobData {
  crawlId: string;
}

export interface AuditJobData {
  crawlId: string;
}

export interface PerformanceJobData {
  crawlId: string;
}

export interface ReportJobData {
  reportId: string;
}

export interface JobDataByQueue {
  [QUEUE_NAMES.CRAWL]: CrawlJobData;
  [QUEUE_NAMES.AUDIT]: AuditJobData;
  [QUEUE_NAMES.PERFORMANCE]: PerformanceJobData;
  [QUEUE_NAMES.REPORT]: ReportJobData;
}

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1000 },
  removeOnFail: { age: 60 * 60 * 24 * 30 },
} as const;
