import type { AuditRuleDefinition } from "@searchanvil/audit-engine";
import type { PrismaClient } from "@searchanvil/database";

/**
 * Upserts every rule in the registry into the AuditRule table (keyed by
 * ruleKey) and returns a ruleKey -> row id map. The rule registry in code
 * is the source of truth; this keeps the DB row (which AuditIssue.ruleId
 * references) in sync with it. Idempotent — safe to call before every
 * audit run.
 */
export async function syncAuditRules(
  prisma: PrismaClient,
  rules: AuditRuleDefinition[],
): Promise<Map<string, string>> {
  const idByKey = new Map<string, string>();
  for (const rule of rules) {
    const row = await prisma.auditRule.upsert({
      where: { ruleKey: rule.key },
      create: {
        ruleKey: rule.key,
        version: rule.version,
        name: rule.name,
        category: rule.category,
        defaultSeverity: rule.defaultSeverity,
        defaultEffort: rule.defaultEffort,
        weight: rule.weight,
        description: rule.description,
        whyItMatters: rule.whyItMatters,
        recommendation: rule.recommendation,
      },
      update: {
        version: rule.version,
        name: rule.name,
        category: rule.category,
        defaultSeverity: rule.defaultSeverity,
        defaultEffort: rule.defaultEffort,
        weight: rule.weight,
        description: rule.description,
        whyItMatters: rule.whyItMatters,
        recommendation: rule.recommendation,
      },
    });
    idByKey.set(rule.key, row.id);
  }
  return idByKey;
}
