import { computePenalty } from "./scoring";
import type { AuditIssueResult, EffortLevel, ImpactLabel, IssueCategory, SiteInput } from "./types";

/** Nudges easy, high-value fixes above hard ones of similar impact — "what should I fix first?" */
const EFFORT_EASE_FACTOR: Record<EffortLevel, number> = {
  EASY: 1.2,
  MEDIUM: 1.0,
  HARD: 0.8,
};

export interface PrioritizedIssue {
  ruleKey: string;
  issue: AuditIssueResult;
  impact: ImpactLabel;
  priorityScore: number;
}

/**
 * Ranks issues by how many Search Health points fixing them would recover
 * (the same penalty computation scoring.ts uses — an issue's priority and
 * its cost to the score are the same underlying quantity), scaled by how
 * easy it is to fix. Deterministic: identical input always produces the
 * same order — ties are broken by ruleKey so the ordering is total, not
 * just "mostly stable." See docs/SCORING.md.
 *
 * Uses the same per-category denominator rule as computeSearchHealth
 * (PERFORMANCE issues are ranked against the sampled page count, not the
 * whole crawl) so an issue's rank and its cost to the score never disagree.
 */
export function prioritizeIssues(site: SiteInput, issues: AuditIssueResult[]): PrioritizedIssue[] {
  const totalPages = site.pages.length;
  const performanceSampleSize = site.pages.filter((p) => p.performance !== undefined).length;
  const denominatorFor = (category: IssueCategory): number =>
    category === "PERFORMANCE" ? performanceSampleSize : totalPages;

  return issues
    .map((issue) => {
      const { penalty } = computePenalty(issue, denominatorFor(issue.rule.category));
      const priorityScore = penalty * EFFORT_EASE_FACTOR[issue.rule.defaultEffort];
      return {
        ruleKey: issue.ruleKey,
        issue,
        impact: impactLabel(penalty),
        priorityScore,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.ruleKey.localeCompare(b.ruleKey));
}

function impactLabel(penalty: number): ImpactLabel {
  if (penalty >= 15) return "HIGH";
  if (penalty >= 5) return "MEDIUM";
  return "LOW";
}
