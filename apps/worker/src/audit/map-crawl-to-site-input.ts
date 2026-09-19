import type { HeadingInput, SiteInput } from "@searchenvil/audit-engine";
import type { PrismaClient } from "@searchenvil/database";

/**
 * Maps persisted Crawl/CrawlPage rows into @searchenvil/audit-engine's own
 * SiteInput shape — the one place that bridges "how facts are stored" and
 * "what the audit engine needs to know." Keeps the audit-engine package
 * itself decoupled from Prisma (see docs/ARCHITECTURE.md).
 */
export async function mapCrawlToSiteInput(prisma: PrismaClient, crawlId: string): Promise<SiteInput> {
  const crawl = await prisma.crawl.findUniqueOrThrow({ where: { id: crawlId } });
  const pages = await prisma.crawlPage.findMany({
    where: { crawlId },
    include: { images: true, structuredData: true, outboundLinks: true },
  });

  return {
    pages: pages.map((page) => ({
      id: page.id,
      url: page.normalizedUrl,
      statusCode: page.statusCode ?? undefined,
      contentType: page.contentType ?? undefined,
      title: page.title ?? undefined,
      metaDescription: page.metaDescription ?? undefined,
      headings: (page.headings as HeadingInput[] | null) ?? [],
      canonicalUrl: page.canonicalUrl ?? undefined,
      metaRobots: page.metaRobots ?? undefined,
      xRobotsTag: page.xRobotsTag ?? undefined,
      language: page.language ?? undefined,
      wordCount: page.wordCount ?? undefined,
      isIndexable: page.isIndexable,
      depth: page.depth,
      fetchError: page.fetchError ?? undefined,
      redirectChain: (page.redirectChain as string[] | null) ?? [],
      images: page.images.map((image) => ({
        src: image.src,
        hasAlt: image.hasAlt,
        altText: image.altText ?? undefined,
      })),
      structuredData: page.structuredData.map((block) => ({
        format: block.format,
        schemaType: block.schemaType ?? undefined,
        isValid: block.isValid,
        errors: (block.errors as string[] | null) ?? undefined,
      })),
      outboundLinks: page.outboundLinks.map((link) => ({
        targetUrl: link.targetUrl,
        isInternal: link.isInternal,
        targetPageId: link.targetPageId ?? undefined,
        anchorText: link.anchorText ?? "",
      })),
    })),
    sitemapUrls: (crawl.sitemapUrls as string[] | null) ?? [],
    robotsTxtFound: crawl.robotsTxtFound,
  };
}
