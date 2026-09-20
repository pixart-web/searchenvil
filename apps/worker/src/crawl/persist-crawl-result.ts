import { normalizeUrl } from "@searchanvil/shared";
import type { CrawlPageResult } from "@searchanvil/crawler";
import type { PrismaClient } from "@searchanvil/database";
import { computeIsIndexable } from "./indexability";

/**
 * Persists one crawled page's facts and increments the parent Crawl's
 * pagesCrawled counter, so a crawl in progress shows live progress rather
 * than jumping from 0 to N only once everything finishes.
 *
 * Links are NOT persisted here — resolving a link's targetPageId requires
 * knowing about pages that may not have been crawled (and persisted) yet.
 * See finalizeCrawlLinks, called once after every page is in.
 */
export async function persistCrawlPage(
  prisma: PrismaClient,
  crawlId: string,
  page: CrawlPageResult,
): Promise<string> {
  const h1 = page.facts?.headings.find((h) => h.level === 1)?.text;
  const isIndexable = computeIsIndexable(page.facts?.metaRobots, page.xRobotsTag);

  const crawlPage = await prisma.crawlPage.upsert({
    where: { crawlId_normalizedUrl: { crawlId, normalizedUrl: page.normalizedUrl } },
    create: {
      crawlId,
      requestedUrl: page.requestedUrl,
      normalizedUrl: page.normalizedUrl,
      finalUrl: page.finalUrl,
      redirectChain: page.redirectChain.length > 0 ? page.redirectChain : undefined,
      statusCode: page.statusCode,
      contentType: page.contentType,
      responseTimeMs: page.responseTimeMs,
      htmlSizeBytes: page.htmlSizeBytes,
      title: page.facts?.title,
      metaDescription: page.facts?.metaDescription,
      h1,
      headings: page.facts?.headings.length ? (page.facts.headings as object) : undefined,
      canonicalUrl: page.facts?.canonicalUrl,
      metaRobots: page.facts?.metaRobots,
      xRobotsTag: page.xRobotsTag,
      language: page.facts?.language,
      wordCount: page.facts?.wordCount,
      isIndexable,
      openGraph: page.facts?.openGraph.length ? (page.facts.openGraph as object) : undefined,
      depth: page.depth,
      fetchError: page.fetchError,
    },
    update: {
      requestedUrl: page.requestedUrl,
      finalUrl: page.finalUrl,
      redirectChain: page.redirectChain.length > 0 ? page.redirectChain : undefined,
      statusCode: page.statusCode,
      contentType: page.contentType,
      responseTimeMs: page.responseTimeMs,
      htmlSizeBytes: page.htmlSizeBytes,
      title: page.facts?.title,
      metaDescription: page.facts?.metaDescription,
      h1,
      headings: page.facts?.headings.length ? (page.facts.headings as object) : undefined,
      canonicalUrl: page.facts?.canonicalUrl,
      metaRobots: page.facts?.metaRobots,
      xRobotsTag: page.xRobotsTag,
      language: page.facts?.language,
      wordCount: page.facts?.wordCount,
      isIndexable,
      openGraph: page.facts?.openGraph.length ? (page.facts.openGraph as object) : undefined,
      depth: page.depth,
      fetchError: page.fetchError,
    },
  });

  await prisma.crawlImage.deleteMany({ where: { pageId: crawlPage.id } });
  await prisma.crawlStructuredDataBlock.deleteMany({ where: { pageId: crawlPage.id } });

  if (page.facts?.images.length) {
    await prisma.crawlImage.createMany({
      data: page.facts.images.map((image) => ({
        pageId: crawlPage.id,
        src: image.src,
        altText: image.altText,
        hasAlt: image.hasAlt,
      })),
    });
  }

  if (page.facts?.structuredData.length) {
    await prisma.crawlStructuredDataBlock.createMany({
      data: page.facts.structuredData.map((block) => ({
        pageId: crawlPage.id,
        format: block.format,
        schemaType: block.schemaType,
        raw: block.raw as object,
        isValid: block.isValid,
        errors: block.errors,
      })),
    });
  }

  await prisma.crawl.update({
    where: { id: crawlId },
    data: { pagesCrawled: { increment: 1 } },
  });

  return crawlPage.id;
}

/**
 * Persists every discovered link, resolving each one's targetPageId against
 * the full set of pages crawled — called once, after all pages are in, so
 * a link to a page crawled later in the run still resolves correctly.
 */
export async function finalizeCrawlLinks(
  prisma: PrismaClient,
  crawlId: string,
  pages: CrawlPageResult[],
): Promise<void> {
  const pageIdByNormalizedUrl = new Map<string, string>();
  const persisted = await prisma.crawlPage.findMany({
    where: { crawlId },
    select: { id: true, normalizedUrl: true },
  });
  persisted.forEach((p) => pageIdByNormalizedUrl.set(p.normalizedUrl, p.id));

  for (const page of pages) {
    if (!page.facts || page.facts.links.length === 0) continue;
    const sourcePageId = pageIdByNormalizedUrl.get(page.normalizedUrl);
    if (!sourcePageId) continue;

    await prisma.crawlLink.deleteMany({ where: { sourcePageId } });

    const data = page.facts.links.map((link) => {
      const targetNormalized = link.resolvedUrl ? normalizeUrl(link.resolvedUrl) : undefined;
      return {
        crawlId,
        sourcePageId,
        targetPageId: targetNormalized ? (pageIdByNormalizedUrl.get(targetNormalized) ?? null) : null,
        targetUrl: link.resolvedUrl ?? link.href,
        isInternal: link.isInternal,
        anchorText: link.anchorText || null,
        relAttribute: link.rel ?? null,
      };
    });

    if (data.length > 0) {
      await prisma.crawlLink.createMany({ data });
    }
  }
}
