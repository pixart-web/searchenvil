export type PerformanceStatus = "COMPLETED" | "FAILED";

export interface PerformanceMetrics {
  status: PerformanceStatus;
  ttfbMs?: number;
  domContentLoadedMs?: number;
  loadTimeMs?: number;
  lcpMs?: number;
  cls?: number;
  errorMessage?: string;
}

export interface CollectOptions {
  /** Hard wall-clock cap for one page's analysis — see docs/PERFORMANCE.md. */
  timeoutMs: number;
  userAgent: string;
}

export type MetricsCollector = (url: string, options: CollectOptions) => Promise<PerformanceMetrics>;
