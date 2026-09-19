import { ALL_RULES } from "./rule-registry";
import type { AuditIssueResult, AuditRuleDefinition, SiteInput } from "./types";

/**
 * Runs every active rule against the given site facts and groups each
 * rule's hits into one AuditIssueResult (an "issue") with N occurrences —
 * matching the DB shape (AuditIssue -> AuditOccurrence[]). Rules that don't
 * fire produce no issue at all, not an empty one.
 */
export function runAudit(site: SiteInput, rules: AuditRuleDefinition[] = ALL_RULES): AuditIssueResult[] {
  const results: AuditIssueResult[] = [];
  for (const rule of rules) {
    const occurrences = rule.evaluate(site);
    if (occurrences.length > 0) {
      results.push({ ruleKey: rule.key, rule, occurrences });
    }
  }
  return results;
}
