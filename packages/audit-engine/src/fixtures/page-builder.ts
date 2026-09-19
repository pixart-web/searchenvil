import type { PageInput, SiteInput } from "../types";

let counter = 0;

/** A minimal, otherwise-clean successful HTML page — override only what a test cares about. */
export function buildPage(overrides: Partial<PageInput> = {}): PageInput {
  counter += 1;
  const id = overrides.id ?? `page-${counter}`;
  return {
    id,
    url: `https://example.com/page-${counter}`,
    statusCode: 200,
    contentType: "text/html",
    title: `A Perfectly Reasonable Page ${counter} Title`,
    metaDescription: "A perfectly adequate meta description that is within the recommended length range for search snippets.",
    headings: [{ level: 1, text: `Page ${counter} Heading` }],
    canonicalUrl: undefined,
    metaRobots: undefined,
    xRobotsTag: undefined,
    language: "en",
    wordCount: 500,
    isIndexable: true,
    depth: 1,
    fetchError: undefined,
    redirectChain: [],
    images: [],
    structuredData: [],
    outboundLinks: [],
    performance: undefined,
    ...overrides,
  };
}

export function buildSite(pages: PageInput[], overrides: Partial<Omit<SiteInput, "pages">> = {}): SiteInput {
  return { pages, sitemapUrls: [], robotsTxtFound: true, ...overrides };
}

export function resetPageCounter(): void {
  counter = 0;
}
