import { groupBy, isSuccessfulHtmlPage, occurrence } from "../rule-helpers";
import type { AuditRuleDefinition } from "../types";

const TITLE_MIN_LENGTH = 15;
const TITLE_MAX_LENGTH = 60;
const META_DESCRIPTION_MIN_LENGTH = 70;
const META_DESCRIPTION_MAX_LENGTH = 160;
const LOW_WORD_COUNT_THRESHOLD = 200;

const missingTitle: AuditRuleDefinition = {
  key: "missing-title",
  version: 1,
  name: "Missing title tag",
  category: "CONTENT",
  defaultSeverity: "HIGH",
  defaultEffort: "EASY",
  weight: 8,
  description: "The page has no <title> tag.",
  whyItMatters:
    "The title tag is one of the strongest on-page ranking signals and is typically what's shown as the clickable headline in search results.",
  recommendation: "Add a unique, descriptive title tag to the page.",
  evaluate: (site) =>
    site.pages.filter((p) => isSuccessfulHtmlPage(p) && !p.title).map((p) => occurrence(p, {})),
};

const duplicateTitle: AuditRuleDefinition = {
  key: "duplicate-title",
  version: 1,
  name: "Duplicate title tag",
  category: "CONTENT",
  defaultSeverity: "MEDIUM",
  defaultEffort: "MEDIUM",
  weight: 5,
  description: "Two or more pages share the exact same title tag.",
  whyItMatters:
    "Duplicate titles make it hard for search engines and users to distinguish between pages, and dilute the ranking signal each page could otherwise have.",
  recommendation: "Write a unique title for each page that reflects its specific content.",
  evaluate: (site) => {
    const groups = groupBy(
      site.pages.filter((p) => isSuccessfulHtmlPage(p) && p.title),
      (p) => p.title,
    );
    return [...groups.values()]
      .filter((pages) => pages.length > 1)
      .flatMap((pages) => pages.map((p) => occurrence(p, { title: p.title, sharedWith: pages.length - 1 })));
  },
};

const titleSuspiciousLength: AuditRuleDefinition = {
  key: "title-suspicious-length",
  version: 1,
  name: "Title length may be suboptimal",
  category: "CONTENT",
  defaultSeverity: "LOW",
  defaultEffort: "EASY",
  weight: 2,
  description: `The title is shorter than ${TITLE_MIN_LENGTH} or longer than ${TITLE_MAX_LENGTH} characters.`,
  whyItMatters:
    "Very short titles waste an opportunity to describe the page; very long ones get truncated in search results. This is a guideline, not a hard rule — some titles are intentionally short.",
  recommendation: `Aim for a title between roughly ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
  evaluate: (site) =>
    site.pages
      .filter((p) => isSuccessfulHtmlPage(p) && p.title)
      .filter((p) => (p.title as string).length < TITLE_MIN_LENGTH || (p.title as string).length > TITLE_MAX_LENGTH)
      .map((p) => occurrence(p, { title: p.title, length: (p.title as string).length })),
};

const missingMetaDescription: AuditRuleDefinition = {
  key: "missing-meta-description",
  version: 1,
  name: "Missing meta description",
  category: "CONTENT",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 4,
  description: "The page has no meta description.",
  whyItMatters:
    "Without a meta description, search engines auto-generate a snippet from page content, which is often less compelling than a written summary.",
  recommendation: "Write a concise, specific meta description for the page.",
  evaluate: (site) =>
    site.pages
      .filter((p) => isSuccessfulHtmlPage(p) && !p.metaDescription)
      .map((p) => occurrence(p, {})),
};

const duplicateMetaDescription: AuditRuleDefinition = {
  key: "duplicate-meta-description",
  version: 1,
  name: "Duplicate meta description",
  category: "CONTENT",
  defaultSeverity: "MEDIUM",
  defaultEffort: "MEDIUM",
  weight: 3,
  description: "Two or more pages share the exact same meta description.",
  whyItMatters:
    "Duplicate descriptions give search results no way to differentiate between pages in the snippet users see.",
  recommendation: "Write a unique meta description for each page.",
  evaluate: (site) => {
    const groups = groupBy(
      site.pages.filter((p) => isSuccessfulHtmlPage(p) && p.metaDescription),
      (p) => p.metaDescription,
    );
    return [...groups.values()]
      .filter((pages) => pages.length > 1)
      .flatMap((pages) =>
        pages.map((p) => occurrence(p, { metaDescription: p.metaDescription, sharedWith: pages.length - 1 })),
      );
  },
};

const metaDescriptionSuspiciousLength: AuditRuleDefinition = {
  key: "meta-description-suspicious-length",
  version: 1,
  name: "Meta description length may be suboptimal",
  category: "CONTENT",
  defaultSeverity: "LOW",
  defaultEffort: "EASY",
  weight: 1,
  description: `The meta description is shorter than ${META_DESCRIPTION_MIN_LENGTH} or longer than ${META_DESCRIPTION_MAX_LENGTH} characters.`,
  whyItMatters:
    "Very short descriptions under-use the available snippet space; very long ones get truncated in search results.",
  recommendation: `Aim for a meta description between roughly ${META_DESCRIPTION_MIN_LENGTH} and ${META_DESCRIPTION_MAX_LENGTH} characters.`,
  evaluate: (site) =>
    site.pages
      .filter((p) => isSuccessfulHtmlPage(p) && p.metaDescription)
      .filter(
        (p) =>
          (p.metaDescription as string).length < META_DESCRIPTION_MIN_LENGTH ||
          (p.metaDescription as string).length > META_DESCRIPTION_MAX_LENGTH,
      )
      .map((p) => occurrence(p, { length: (p.metaDescription as string).length })),
};

const lowWordCount: AuditRuleDefinition = {
  key: "low-word-count",
  version: 1,
  name: "Thin content",
  category: "CONTENT",
  defaultSeverity: "NOTICE",
  defaultEffort: "HARD",
  weight: 3,
  description: `The page has fewer than ${LOW_WORD_COUNT_THRESHOLD} words of visible body text.`,
  whyItMatters:
    "Very thin pages often struggle to rank because they offer little substance for search engines to match against queries. Some page types (contact pages, simple landing pages) are legitimately short — treat this as a prompt to review, not a defect.",
  recommendation: "Consider expanding the page with more substantive, relevant content, if appropriate for its purpose.",
  evaluate: (site) =>
    site.pages
      .filter((p) => isSuccessfulHtmlPage(p) && typeof p.wordCount === "number" && p.wordCount < LOW_WORD_COUNT_THRESHOLD)
      .map((p) => occurrence(p, { wordCount: p.wordCount })),
};

const duplicateH1: AuditRuleDefinition = {
  key: "duplicate-h1",
  version: 1,
  name: "Duplicate H1 across pages",
  category: "CONTENT",
  defaultSeverity: "LOW",
  defaultEffort: "MEDIUM",
  weight: 2,
  description: "Two or more pages share the exact same H1 text.",
  whyItMatters:
    "Like duplicate titles, identical H1s across pages make it harder to signal what's distinct about each page.",
  recommendation: "Give each page an H1 that reflects its specific content.",
  evaluate: (site) => {
    const withH1 = site.pages
      .filter(isSuccessfulHtmlPage)
      .map((p) => ({ page: p, h1: p.headings.find((h) => h.level === 1)?.text }))
      .filter((entry): entry is { page: (typeof site.pages)[number]; h1: string } => Boolean(entry.h1));

    const groups = groupBy(withH1, (entry) => entry.h1);
    return [...groups.values()]
      .filter((entries) => entries.length > 1)
      .flatMap((entries) =>
        entries.map((entry) => occurrence(entry.page, { h1: entry.h1, sharedWith: entries.length - 1 })),
      );
  },
};

const missingAltText: AuditRuleDefinition = {
  key: "missing-alt-text",
  version: 1,
  name: "Image missing alt text",
  category: "CONTENT",
  defaultSeverity: "MEDIUM",
  defaultEffort: "EASY",
  weight: 3,
  description: "One or more images on the page have no alt attribute at all.",
  whyItMatters:
    "Alt text is read aloud by screen readers and used by search engines to understand image content — images without it are invisible to both.",
  recommendation: "Add descriptive alt text to every meaningful image (empty alt=\"\" is fine for purely decorative ones).",
  evaluate: (site) =>
    site.pages
      .filter((p) => p.images.some((img) => !img.hasAlt))
      .map((p) => occurrence(p, { missingCount: p.images.filter((img) => !img.hasAlt).length })),
};

export const contentRules: AuditRuleDefinition[] = [
  missingTitle,
  duplicateTitle,
  titleSuspiciousLength,
  missingMetaDescription,
  duplicateMetaDescription,
  metaDescriptionSuspiciousLength,
  lowWordCount,
  duplicateH1,
  missingAltText,
];
