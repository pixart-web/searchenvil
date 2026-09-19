import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@searchenvil/database";
import type { CrawlConfig, CrawlPageResult, CrawlResult, RunCrawlOptions } from "@searchenvil/crawler";
import { processCrawlJob } from "./process-crawl-job";

async function seedCrawl(): Promise<{ crawlId: string; cleanup: () => Promise<void> }> {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: { email: `worker-test-${suffix}@searchenvil.test`, name: "Worker Test", passwordHash: "x" },
  });
  const org = await prisma.organization.create({
    data: {
      name: `Worker Test Org ${suffix}`,
      slug: `worker-test-org-${suffix}`,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  const project = await prisma.project.create({
    data: { organizationId: org.id, name: "Worker Test Project" },
  });
  const site = await prisma.site.create({
    data: { projectId: project.id, displayName: "Test Site", rootUrl: `https://site-${suffix}.example.com` },
  });
  const crawl = await prisma.crawl.create({
    data: { siteId: site.id, config: {}, maxPages: 200, maxDepth: 5 },
  });

  return {
    crawlId: crawl.id,
    cleanup: async () => {
      await prisma.organization.delete({ where: { id: org.id } }); // cascades everything else
    },
  };
}

function page(overrides: Partial<CrawlPageResult> & { normalizedUrl: string }): CrawlPageResult {
  return {
    requestedUrl: overrides.normalizedUrl,
    finalUrl: overrides.normalizedUrl,
    redirectChain: [],
    statusCode: 200,
    contentType: "text/html",
    xRobotsTag: undefined,
    responseTimeMs: 10,
    htmlSizeBytes: 100,
    body: "<html></html>",
    fetchError: undefined,
    depth: 0,
    facts: {
      title: "A Page",
      metaDescription: undefined,
      headings: [{ level: 1, text: "Heading" }],
      canonicalUrl: undefined,
      metaRobots: undefined,
      language: "en",
      wordCount: 10,
      links: [],
      images: [],
      structuredData: [],
      openGraph: [],
    },
    ...overrides,
  };
}

describe("processCrawlJob", () => {
  const cleanups: (() => Promise<void>)[] = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      await cleanup?.();
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists pages, resolves links, and completes successfully", async () => {
    const { crawlId, cleanup } = await seedCrawl();
    cleanups.push(cleanup);

    const site = await prisma.crawl.findUniqueOrThrow({ where: { id: crawlId }, include: { site: true } });
    const home = `${site.site.rootUrl}/`;
    const about = `${site.site.rootUrl}/about`;

    const fakeRunCrawl = async (
      _config: CrawlConfig,
      options: RunCrawlOptions,
    ): Promise<CrawlResult> => {
      const homePage = page({
        normalizedUrl: home,
        facts: {
          title: "Home",
          metaDescription: "desc",
          headings: [{ level: 1, text: "Home" }],
          canonicalUrl: undefined,
          metaRobots: undefined,
          language: "en",
          wordCount: 5,
          links: [
            { href: "/about", resolvedUrl: about, isInternal: true, anchorText: "About", rel: undefined },
          ],
          images: [{ src: "/logo.png", altText: "Logo", hasAlt: true }],
          structuredData: [
            { format: "json-ld", schemaType: "Organization", raw: { "@type": "Organization" }, isValid: true, errors: undefined },
          ],
          openGraph: [],
        },
      });
      const aboutPage = page({ normalizedUrl: about, depth: 1 });
      options.onPageCrawled?.(homePage);
      options.onPageCrawled?.(aboutPage);
      return {
        pages: [homePage, aboutPage],
        sitemapUrls: [`${home}sitemap.xml`],
        robotsTxtFound: true,
      };
    };

    let enqueuedAuditFor: string | undefined;
    await processCrawlJob(
      { prisma, runCrawl: fakeRunCrawl, enqueueAuditJob: async (id) => { enqueuedAuditFor = id; } },
      crawlId,
    );

    const finished = await prisma.crawl.findUniqueOrThrow({ where: { id: crawlId } });
    expect(finished.status).toBe("COMPLETED");
    expect(finished.pagesCrawled).toBe(2);
    expect(finished.startedAt).toBeTruthy();
    expect(finished.sitemapUrls).toEqual([`${home}sitemap.xml`]);
    expect(finished.robotsTxtFound).toBe(true);
    expect(enqueuedAuditFor).toBe(crawlId);
    expect(finished.finishedAt).toBeTruthy();

    const pages = await prisma.crawlPage.findMany({ where: { crawlId }, orderBy: { normalizedUrl: "asc" } });
    expect(pages).toHaveLength(2);
    const homeRow = pages.find((p) => p.normalizedUrl === home);
    expect(homeRow?.title).toBe("Home");
    expect(homeRow?.h1).toBe("Home");
    expect(homeRow?.isIndexable).toBe(true);

    const images = await prisma.crawlImage.findMany({ where: { pageId: homeRow!.id } });
    expect(images).toHaveLength(1);
    expect(images[0]?.altText).toBe("Logo");

    const structuredData = await prisma.crawlStructuredDataBlock.findMany({ where: { pageId: homeRow!.id } });
    expect(structuredData).toHaveLength(1);
    expect(structuredData[0]?.schemaType).toBe("Organization");

    const links = await prisma.crawlLink.findMany({ where: { crawlId } });
    expect(links).toHaveLength(1);
    const aboutRow = pages.find((p) => p.normalizedUrl === about);
    expect(links[0]?.targetPageId).toBe(aboutRow?.id);
  });

  it("marks the crawl FAILED with an error message when the crawl throws", async () => {
    const { crawlId, cleanup } = await seedCrawl();
    cleanups.push(cleanup);

    const fakeRunCrawl = async (): Promise<CrawlResult> => {
      throw new Error("network exploded");
    };

    let auditEnqueued = false;
    await processCrawlJob(
      { prisma, runCrawl: fakeRunCrawl, enqueueAuditJob: async () => { auditEnqueued = true; } },
      crawlId,
    );

    const finished = await prisma.crawl.findUniqueOrThrow({ where: { id: crawlId } });
    expect(finished.status).toBe("FAILED");
    expect(finished.errorMessage).toBe("network exploded");
    expect(auditEnqueued).toBe(false);
  });

  it("stops and marks the crawl CANCELLED when cancellation is requested mid-run", async () => {
    const { crawlId, cleanup } = await seedCrawl();
    cleanups.push(cleanup);

    const fakeRunCrawl = async (
      _config: CrawlConfig,
      options: RunCrawlOptions,
    ): Promise<CrawlResult> => {
      // Simulate the cancel API endpoint being hit while this "crawl" is mid-flight.
      await prisma.crawl.update({ where: { id: crawlId }, data: { status: "CANCELLED" } });
      // Give the job's cancellation-polling interval a chance to observe it.
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(options.signal?.aborted).toBe(true);
      return { pages: [], sitemapUrls: [], robotsTxtFound: false };
    };

    let auditEnqueued = false;
    await processCrawlJob(
      {
        prisma,
        runCrawl: fakeRunCrawl,
        cancellationCheckIntervalMs: 10,
        enqueueAuditJob: async () => { auditEnqueued = true; },
      },
      crawlId,
    );

    const finished = await prisma.crawl.findUniqueOrThrow({ where: { id: crawlId } });
    expect(finished.status).toBe("CANCELLED");
    expect(auditEnqueued).toBe(false);
  });

  it("does nothing for a crawl that is already cancelled before processing starts", async () => {
    const { crawlId, cleanup } = await seedCrawl();
    cleanups.push(cleanup);
    await prisma.crawl.update({ where: { id: crawlId }, data: { status: "CANCELLED" } });

    const fakeRunCrawl = async (): Promise<CrawlResult> => {
      throw new Error("should never be called");
    };

    await expect(processCrawlJob({ prisma, runCrawl: fakeRunCrawl }, crawlId)).resolves.toBeUndefined();
    const finished = await prisma.crawl.findUniqueOrThrow({ where: { id: crawlId } });
    expect(finished.status).toBe("CANCELLED");
  });
});
