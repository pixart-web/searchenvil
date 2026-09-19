import { occurrence } from "../rule-helpers";
import type { AuditRuleDefinition } from "../types";

const invalidStructuredData: AuditRuleDefinition = {
  key: "invalid-structured-data",
  version: 1,
  name: "Malformed structured data",
  category: "STRUCTURED_DATA",
  defaultSeverity: "MEDIUM",
  defaultEffort: "MEDIUM",
  weight: 4,
  confidence: 1.0,
  description: "A JSON-LD structured data block on the page failed to parse.",
  whyItMatters:
    "Malformed structured data is ignored entirely by search engines — any rich-result eligibility it was meant to provide (review stars, breadcrumbs, etc.) is lost.",
  recommendation: "Fix the JSON syntax error in the structured data block.",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.structuredData.some((block) => !block.isValid))
      .map((p) =>
        occurrence(p, {
          invalidBlocks: p.structuredData.filter((block) => !block.isValid).map((block) => block.errors),
        }),
      ),
};

export const structuredDataRules: AuditRuleDefinition[] = [invalidStructuredData];
