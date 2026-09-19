import type { IssueSeverity } from "@searchenvil/audit-engine";

/**
 * Deliberately simple placeholder — Phase 08 ("Search Health & Forge
 * Priorities") owns the real, documented scoring/prioritization
 * methodology (severity + impact + confidence + affected-page count +
 * rule weight + category, per docs/SCORING.md once it exists). This just
 * needs to produce *a* stable, defensible ordering now so AuditIssue rows
 * are queryable/sortable before that lands.
 */
const SEVERITY_RANK: Record<IssueSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  NOTICE: 1,
};

export function placeholderImpact(severity: IssueSeverity): string {
  if (severity === "CRITICAL" || severity === "HIGH") return "HIGH";
  if (severity === "MEDIUM") return "MEDIUM";
  return "LOW";
}

export function placeholderPriorityScore(
  severity: IssueSeverity,
  weight: number,
  affectedPageCount: number,
): number {
  return SEVERITY_RANK[severity] * weight * Math.log2(affectedPageCount + 1);
}
