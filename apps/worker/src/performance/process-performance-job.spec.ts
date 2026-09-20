import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@searchanvil/database";
import type { MetricsCollector } from "@searchanvil/performance";
import { processPerformanceJob } from "./process-performance-job";

async function seedCrawlWithPages(pageCount: number): Promise<{ crawlId: string; pageIds: string[]; cleanup: () => Promise<void> }> {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: { email: `perf-test-${suffix}@searchanvil.test`, name: "Perf Test", passwordHash: "x" },
  });
  const org = await prisma.organization.create({
    data: {
      name: `Perf Test Org ${suffix}`,
      slug: `perf-test-org-${suffix}`,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  const project = await prisma.project.create({ data: { organizationId: org.id, name: "Perf Test Project" } });
  const site = await prisma.site.create({
    data: { projectId: project.id, displayName: "Test Site", rootUrl: `https://perf-${suffix}.example.com` },
  });
  const crawl = await prisma.crawl.create({
    data: { siteId: site.id, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5 },
  });

  const pageIds: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = await prisma.crawlPage.create({
      data: {
        crawlId: crawl.id,
        requestedUrl: `https://perf-${suffix}.example.com/${i}`,
        normalizedUrl: `https://perf-${suffix}.example.com/${i}`,
        finalUrl: `https://perf-${suffix}.example.com/${i}`,
        statusCode: 200,
        isIndexable: true,
        depth: i,
      },
    });
    pageIds.push(page.id);
  }

  return {
    crawlId: crawl.id,
    pageIds,
    cleanup: async () => {
      await prisma.organization.delete({ where: { id: org.id } });
    },
  };
}

describe("processPerformanceJob", () => {
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

  it("analyzes only the sampled pages, leaving no row for the rest", async () => {
    const { crawlId, pageIds, cleanup } = await seedCrawlWithPages(10);
    cleanups.push(cleanup);

    const fakeCollector: MetricsCollector = async () => ({
      status: "COMPLETED",
      ttfbMs: 100,
      domContentLoadedMs: 200,
      loadTimeMs: 300,
      lcpMs: 1200,
      cls: 0.05,
    });

    await processPerformanceJob({ prisma, collector: fakeCollector, maxSamples: 3 }, crawlId);

    const rows = await prisma.pagePerformance.findMany({ where: { pageId: { in: pageIds } } });
    expect(rows).toHaveLength(3);
    // Shallowest pages (lowest depth) win the sample — page 0, 1, 2.
    expect(rows.map((r) => r.pageId).sort()).toEqual([pageIds[0], pageIds[1], pageIds[2]].sort());
    expect(rows[0]?.status).toBe("COMPLETED");
    expect(rows[0]?.lcpMs).toBe(1200);
    expect(rows[0]?.analyzedAt).toBeTruthy();
  });

  it("persists a FAILED row with the error message when the collector throws", async () => {
    const { crawlId, pageIds, cleanup } = await seedCrawlWithPages(1);
    cleanups.push(cleanup);

    const failingCollector: MetricsCollector = async () => {
      throw new Error("browser crashed");
    };

    await processPerformanceJob({ prisma, collector: failingCollector, maxSamples: 5 }, crawlId);

    const row = await prisma.pagePerformance.findUniqueOrThrow({ where: { pageId: pageIds[0] } });
    expect(row.status).toBe("FAILED");
    expect(row.errorMessage).toBe("browser crashed");
  });

  it("persists a FAILED row when the collector resolves with a FAILED status (no throw)", async () => {
    const { crawlId, pageIds, cleanup } = await seedCrawlWithPages(1);
    cleanups.push(cleanup);

    const collector: MetricsCollector = async () => ({
      status: "FAILED",
      errorMessage: "navigation timeout",
    });

    await processPerformanceJob({ prisma, collector, maxSamples: 5 }, crawlId);

    const row = await prisma.pagePerformance.findUniqueOrThrow({ where: { pageId: pageIds[0] } });
    expect(row.status).toBe("FAILED");
    expect(row.errorMessage).toBe("navigation timeout");
  });

  it("does nothing when there are no pages in the crawl", async () => {
    const { crawlId, cleanup } = await seedCrawlWithPages(0);
    cleanups.push(cleanup);

    const collector: MetricsCollector = async () => ({ status: "COMPLETED" });
    await expect(processPerformanceJob({ prisma, collector, maxSamples: 5 }, crawlId)).resolves.toBeUndefined();
  });
});
