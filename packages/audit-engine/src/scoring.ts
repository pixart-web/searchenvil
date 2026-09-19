import type { AuditIssueResult, IssueCategory, IssueSeverity, SiteInput } from "./types";

export const SCORING_VERSION = "2026.1";

/**
 * Base penalty points a single fully-confident occurrence, affecting every
 * page in the crawl, would cost its category. Scaled down by confidence and
 * by how much of the site is actually affected — see computePenalty().
 */
const SEVERITY_BASE_PENALTY: Record<IssueSeverity, number> = {
  CRITICAL: 40,
  HIGH: 25,
  MEDIUM: 12,
  LOW: 5,
  NOTICE: 1,
};

/** Categories the audit engine currently has rules for — see docs/SCORING.md. */
const SCORED_CATEGORIES: IssueCategory[] = [
  "TECHNICAL",
  "INDEXABILITY",
  "CONTENT",
  "INTERNAL_LINKING",
  "STRUCTURED_DATA",
  "PERFORMANCE",
];

export interface IssuePenaltyBreakdown {
  ruleKey: string;
  category: IssueCategory;
  severity: IssueSeverity;
  affectedPageCount: number;
  affectedRatio: number;
  confidence: number;
  weight: number;
  penalty: number;
}

export interface CategoryScoreBreakdown {
  category: IssueCategory;
  score: number;
  totalPenalty: number;
  issueCount: number;
}

export interface ScoreExplanation {
  scoringVersion: string;
  totalPages: number;
  categories: CategoryScoreBreakdown[];
  issuePenalties: IssuePenaltyBreakdown[];
  /** overallScore is the unweighted mean of the categories above — see docs/SCORING.md. */
  overallScore: number;
}

export interface SearchHealthResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  explanation: ScoreExplanation;
}

/**
 * Penalty for one issue (all its occurrences), in points against its
 * category's 100-point budget:
 *
 *   severityBase(severity) * confidence * (weight / 10) * affectedRatio
 *
 * - severityBase: how bad this class of problem is at its worst.
 * - confidence: how sure we are it's actually a problem (see
 *   AuditRuleDefinition.confidence) — a contextual finding never costs as
 *   much as a deterministic one of the same severity.
 * - weight / 10: the rule's configured relative importance, normalized
 *   around 1.0 (weights run roughly 1-10).
 * - affectedRatio: fraction of crawled pages the issue touches, capped at
 *   1 — a defect on every page costs more than the same defect on one page
 *   out of hundreds.
 */
export function computePenalty(
  issue: AuditIssueResult,
  totalPages: number,
): IssuePenaltyBreakdown {
  const affectedRatio = totalPages > 0 ? Math.min(1, issue.occurrences.length / totalPages) : 0;
  const penalty =
    SEVERITY_BASE_PENALTY[issue.rule.defaultSeverity] *
    issue.rule.confidence *
    (issue.rule.weight / 10) *
    affectedRatio;

  return {
    ruleKey: issue.ruleKey,
    category: issue.rule.category,
    severity: issue.rule.defaultSeverity,
    affectedPageCount: issue.occurrences.length,
    affectedRatio,
    confidence: issue.rule.confidence,
    weight: issue.rule.weight,
    penalty,
  };
}

/**
 * Computes Search Health: each scored category starts at 100 and loses
 * points per firing issue (computePenalty), floored at 0. The overall score
 * is the unweighted mean of the category scores that have at least one
 * applicable rule (see SCORED_CATEGORIES). Deterministic: identical issues +
 * page count always produce identical scores, and `explanation` captures
 * the full per-issue breakdown so a score can be explained even after the
 * scoring formula itself later changes (each score is stamped with the
 * scoringVersion that produced it).
 *
 * PERFORMANCE issues use the number of *sampled* pages as their
 * affectedRatio denominator, not the total crawl size — performance
 * analysis only ever runs on a small bounded sample (docs/PERFORMANCE.md),
 * so "3 of 3 sampled pages have poor LCP" must not be diluted into "3 of
 * 200 crawled pages," which would understate a real, consistent problem.
 */
export function computeSearchHealth(site: SiteInput, issues: AuditIssueResult[]): SearchHealthResult {
  const totalPages = site.pages.length;
  const performanceSampleSize = site.pages.filter((p) => p.performance !== undefined).length;
  const denominatorFor = (category: IssueCategory): number =>
    category === "PERFORMANCE" ? performanceSampleSize : totalPages;

  const penalties = issues.map((issue) => computePenalty(issue, denominatorFor(issue.rule.category)));

  // PERFORMANCE is only scored once at least one page has actually been
  // analyzed — before that, "no performance issues found" would really
  // mean "no performance data exists yet," and silently scoring it 100
  // would misrepresent absence of data as a clean bill of health.
  const scoredCategories = SCORED_CATEGORIES.filter(
    (category) => category !== "PERFORMANCE" || performanceSampleSize > 0,
  );

  const categories: CategoryScoreBreakdown[] = scoredCategories.map((category) => {
    const categoryPenalties = penalties.filter((p) => p.category === category);
    const totalPenalty = categoryPenalties.reduce((sum, p) => sum + p.penalty, 0);
    return {
      category,
      score: Math.round(clamp(100 - totalPenalty, 0, 100)),
      totalPenalty,
      issueCount: categoryPenalties.length,
    };
  });

  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
  );

  const categoryScores: Record<string, number> = {};
  for (const c of categories) categoryScores[c.category] = c.score;

  return {
    overallScore,
    categoryScores,
    explanation: {
      scoringVersion: SCORING_VERSION,
      totalPages,
      categories,
      issuePenalties: penalties,
      overallScore,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
