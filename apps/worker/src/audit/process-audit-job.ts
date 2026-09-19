import { ALL_RULES, RULESET_VERSION, runAudit, type SiteInput } from "@searchenvil/audit-engine";
import type { PrismaClient } from "@searchenvil/database";
import { logger } from "../logger";
import { mapCrawlToSiteInput } from "./map-crawl-to-site-input";
import { syncAuditRules } from "./sync-audit-rules";
import { placeholderImpact, placeholderPriorityScore } from "./placeholder-priority";

export interface ProcessAuditJobDeps {
  prisma: PrismaClient;
  /** Injection point for tests; defaults to the real audit engine in production. */
  buildSiteInput?: (prisma: PrismaClient, crawlId: string) => Promise<SiteInput>;
}

/**
 * Runs the audit engine against a completed crawl's persisted facts and
 * writes the results as AuditRun -> AuditIssue -> AuditOccurrence rows.
 * Priority/impact here are placeholders — see placeholder-priority.ts;
 * Phase 08 replaces them with the real scoring methodology without
 * changing this pipeline's shape.
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

    for (const issue of issues) {
      const ruleId = ruleIdByKey.get(issue.ruleKey);
      if (!ruleId) continue; // Should be impossible — syncAuditRules just registered every rule.

      const auditIssue = await prisma.auditIssue.create({
        data: {
          auditRunId: auditRun.id,
          ruleId,
          severity: issue.rule.defaultSeverity,
          impact: placeholderImpact(issue.rule.defaultSeverity),
          effort: issue.rule.defaultEffort,
          affectedPageCount: issue.occurrences.length,
          title: issue.rule.name,
          summary: issue.rule.description,
          priorityScore: placeholderPriorityScore(
            issue.rule.defaultSeverity,
            issue.rule.weight,
            issue.occurrences.length,
          ),
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

    await prisma.auditRun.update({
      where: { id: auditRun.id },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });

    logger.info("audit run finished", { crawlId, auditRunId: auditRun.id, issueCount: issues.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("audit run failed", { crawlId, error: message });
    await prisma.auditRun.update({
      where: { id: auditRun.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
    });
  }
}
