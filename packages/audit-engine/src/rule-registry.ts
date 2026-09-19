import { technicalRules } from "./rules/technical";
import { indexabilityRules } from "./rules/indexability";
import { contentRules } from "./rules/content";
import { internalLinkingRules } from "./rules/internal-linking";
import { structuredDataRules } from "./rules/structured-data";
import { performanceRules } from "./rules/performance";
import type { AuditRuleDefinition } from "./types";

export const ALL_RULES: AuditRuleDefinition[] = [
  ...technicalRules,
  ...indexabilityRules,
  ...contentRules,
  ...internalLinkingRules,
  ...structuredDataRules,
  ...performanceRules,
];

export const RULESET_VERSION = "2026.1";

const byKey = new Map<string, AuditRuleDefinition>();
for (const rule of ALL_RULES) {
  if (byKey.has(rule.key)) {
    throw new Error(`Duplicate audit rule key: "${rule.key}"`);
  }
  byKey.set(rule.key, rule);
}

export function getRuleByKey(key: string): AuditRuleDefinition | undefined {
  return byKey.get(key);
}
