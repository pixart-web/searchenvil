import { occurrence } from "../rule-helpers";
import type { AuditRuleDefinition } from "../types";

// Google's published Core Web Vitals "poor" thresholds — not an invented
// number, a cited external standard. See docs/PERFORMANCE.md.
const LCP_POOR_THRESHOLD_MS = 4000;
const CLS_POOR_THRESHOLD = 0.25;
const SLOW_TTFB_THRESHOLD_MS = 800;

const poorLcp: AuditRuleDefinition = {
  key: "poor-lcp",
  version: 1,
  name: "Slow Largest Contentful Paint",
  category: "PERFORMANCE",
  defaultSeverity: "HIGH",
  defaultEffort: "HARD",
  weight: 6,
  confidence: 0.9,
  description: `Largest Contentful Paint exceeded ${LCP_POOR_THRESHOLD_MS}ms, Google's "poor" Core Web Vitals threshold.`,
  whyItMatters:
    "LCP measures how long the main content takes to appear. A poor LCP means visitors wait noticeably before the page feels usable, which affects both user experience and search ranking (Core Web Vitals are a ranking signal).",
  recommendation:
    "Optimize the largest above-the-fold element: compress/resize hero images, preload critical resources, and reduce render-blocking scripts/stylesheets.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.performance?.status === "COMPLETED" && (p.performance.lcpMs ?? 0) > LCP_POOR_THRESHOLD_MS)
      .map((p) => occurrence(p, { lcpMs: p.performance?.lcpMs })),
};

const highCls: AuditRuleDefinition = {
  key: "high-cls",
  version: 1,
  name: "High Cumulative Layout Shift",
  category: "PERFORMANCE",
  defaultSeverity: "MEDIUM",
  defaultEffort: "MEDIUM",
  weight: 4,
  confidence: 0.85,
  description: `Cumulative Layout Shift exceeded ${CLS_POOR_THRESHOLD}, Google's "poor" Core Web Vitals threshold.`,
  whyItMatters:
    "A high CLS means visible content jumps around as the page loads, which is disorienting and can cause misclicks — a real, measurable usability problem, not just a technical metric.",
  recommendation:
    "Reserve space for images/embeds with explicit width/height, avoid inserting content above existing content after load, and preload web fonts to avoid layout-shifting font swaps.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.performance?.status === "COMPLETED" && (p.performance.cls ?? 0) > CLS_POOR_THRESHOLD)
      .map((p) => occurrence(p, { cls: p.performance?.cls })),
};

const slowTtfb: AuditRuleDefinition = {
  key: "slow-ttfb",
  version: 1,
  name: "Slow server response time",
  category: "PERFORMANCE",
  defaultSeverity: "MEDIUM",
  defaultEffort: "HARD",
  weight: 3,
  confidence: 0.7,
  description: `Time to First Byte exceeded ${SLOW_TTFB_THRESHOLD_MS}ms.`,
  whyItMatters:
    "A slow first byte delays everything downstream — rendering, LCP, interactivity — regardless of how well-optimized the rest of the page is. Often points to server/hosting/database issues rather than front-end code.",
  recommendation:
    "Investigate server-side response time: database query performance, caching, and hosting/CDN configuration.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.performance?.status === "COMPLETED" && (p.performance.ttfbMs ?? 0) > SLOW_TTFB_THRESHOLD_MS)
      .map((p) => occurrence(p, { ttfbMs: p.performance?.ttfbMs })),
};

const performanceAnalysisFailed: AuditRuleDefinition = {
  key: "performance-analysis-failed",
  version: 1,
  name: "Performance analysis could not complete",
  category: "PERFORMANCE",
  defaultSeverity: "NOTICE",
  defaultEffort: "EASY",
  weight: 1,
  confidence: 1.0,
  description: "The sampled performance check for this page failed to complete (e.g. it timed out or the browser navigation failed).",
  whyItMatters:
    "This isn't a finding about the page's actual performance — it's an honest signal that we don't have data for this page, distinct from the page being fine. See docs/PERFORMANCE.md.",
  recommendation: "Re-run the audit; if this persists, the page may be unusually slow to load or blocking automated browsers.",
  evaluate: (site) =>
    site.pages.filter((p) => p.performance?.status === "FAILED").map((p) => occurrence(p, {})),
};

export const performanceRules: AuditRuleDefinition[] = [poorLcp, highCls, slowTtfb, performanceAnalysisFailed];
