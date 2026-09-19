import {
  ALL_RULES,
  RULESET_VERSION,
  SCORING_VERSION,
  computeSearchHealth,
  prioritizeIssues,
  runAudit,
  type SiteInput,
} from "@searchenvil/audit-engine";
import type { PrismaClient } from "@searchenvil/database";
import { logger } from "../logger";
import { mapCrawlToSiteInput } from "./map-crawl-to-site-input";
import { syncAuditRules } from "./sync-audit-rules";

export interface ProcessAuditJobDeps {
  prisma: PrismaClient;
  /** Injection point for tests; defaults to the real audit engine in production. */
  buildSiteInput?: (prisma: PrismaClient, crawlId: string) => Promise<SiteInput>;
}

/**
 * Runs the audit engine against a completed crawl's persisted facts and
 * writes the results as AuditRun -> AuditIssue -> AuditOccurrence, plus a
 * versioned AuditScore. Priority/impact/Search Health all come from
 * @searchenvil/audit-engine's documented scoring methodology (see
 * docs/SCORING.md) — this pipeline just persists what that package computes.
 */
export async function processAuditJob(deps: ProcessAuditJobDeps, crawlId: string): Promise<void> {
  const { prisma } = deps;
  const buildSiteInput = deps.buildSiteInput ?? mapCrawlToSiteInput;

  const existing = await prisma.auditRun.findUnique({ where: { crawlId } });
  if (existing && existing.status !== "FAILED") {
    logger.info("audit run already exists for this crawl", { crawlId, status: existing.status });
    return;
  }

  const auditRun = existing
    ? await prisma.auditRun.update({
        where: { id: existing.id },
        data: { status: "RUNNING", startedAt: new Date(), errorMessage: null },
      })
    : await prisma.auditRun.create({
        data: { crawlId, rulesetVersion: RULESET_VERSION, status: "RUNNING", startedAt: new Date() },
      });

  try {
    const ruleIdByKey = await syncAuditRules(prisma, ALL_RULES);
    const site = await buildSiteInput(prisma, crawlId);
    const issues = runAudit(site, ALL_RULES);

    const prioritized = new Map(prioritizeIssues(site, issues).map((p) => [p.ruleKey, p]));
    const health = computeSearchHealth(site, issues);

    for (const issue of issues) {
      const ruleId = ruleIdByKey.get(issue.ruleKey);
      const priority = prioritized.get(issue.ruleKey);
      if (!ruleId || !priority) continue; // Should be impossible — both are derived from the same `issues`.

      const auditIssue = await prisma.auditIssue.create({
        data: {
          auditRunId: auditRun.id,
          ruleId,
          severity: issue.rule.defaultSeverity,
          impact: priority.impact,
          effort: issue.rule.defaultEffort,
          affectedPageCount: issue.occurrences.length,
          title: issue.rule.name,
          summary: issue.rule.description,
          priorityScore: priority.priorityScore,
        },
      });

      await prisma.auditOccurrence.createMany({
        data: issue.occurrences.map((occ) => ({
          auditIssueId: auditIssue.id,
          pageId: occ.pageId,
          evidence: occ.evidence as object,
        })),
      });
    }

    await prisma.auditScore.upsert({
      where: { auditRunId: auditRun.id },
      create: {
        auditRunId: auditRun.id,
        scoringVersion: SCORING_VERSION,
        overallScore: health.overallScore,
        categoryScores: health.categoryScores,
        explanation: health.explanation as unknown as object,
      },
      update: {
        scoringVersion: SCORING_VERSION,
        overallScore: health.overallScore,
        categoryScores: health.categoryScores,
        explanation: health.explanation as unknown as object,
      },
    });

    await prisma.auditRun.update({
      where: { id: auditRun.id },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });

    logger.info("audit run finished", {
      crawlId,
      auditRunId: auditRun.id,
      issueCount: issues.length,
      overallScore: health.overallScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("audit run failed", { crawlId, error: message });
    await prisma.auditRun.update({
      where: { id: auditRun.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
    });
  }
}
