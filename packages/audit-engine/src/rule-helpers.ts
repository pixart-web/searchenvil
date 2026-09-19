import type { Occurrence, PageInput } from "./types";

export function declaresNoindex(value: string | undefined): boolean {
  return (value ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .includes("noindex");
}

/** Only pages that were actually fetched successfully make sense for on-page content checks. */
export function isSuccessfulHtmlPage(page: PageInput): boolean {
  return page.statusCode === 200 && !page.fetchError;
}

export function groupBy<T, K>(items: T[], keyFn: (item: T) => K | undefined): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (key === undefined) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

export function occurrence(page: PageInput, evidence: Record<string, unknown>): Occurrence {
  return { pageId: page.id, pageUrl: page.url, evidence };
}

export function findPageById(site: { pages: PageInput[] }, pageId: string): PageInput | undefined {
  return site.pages.find((p) => p.id === pageId);
}
