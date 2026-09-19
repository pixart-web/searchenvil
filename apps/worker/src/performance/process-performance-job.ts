import { DEFAULT_MAX_SAMPLES, selectSamplePages, type MetricsCollector } from "@searchenvil/performance";
import type { PrismaClient } from "@searchenvil/database";
import { logger } from "../logger";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = "SearchEnvilBot/0.1 (+https://searchenvil.com/bot)";

export interface ProcessPerformanceJobDeps {
  prisma: PrismaClient;
  collector: MetricsCollector;
  maxSamples?: number;
  timeoutPerPageMs?: number;
  userAgent?: string;
}

/**
 * Analyzes a small, bounded sample of a crawl's pages (never all of them —
 * see docs/PERFORMANCE.md) sequentially, one browser launch at a time. This
 * job itself also only ever runs at low queue concurrency (apps/worker/src/
 * main.ts) — the two bounds are independent and both matter: sequential
 * processing within a job keeps one job's memory/CPU footprint predictable,
 * and low queue concurrency keeps multiple simultaneous jobs from stacking
 * up browser processes.
 */
export async function processPerformanceJob(deps: ProcessPerformanceJobDeps, crawlId: string): Promise<void> {
  const { prisma } = deps;

  const pages = await prisma.crawlPage.findMany({
    where: { crawlId },
    select: { id: true, normalizedUrl: true, depth: true, statusCode: true },
  });

  const sampled = selectSamplePages(pages, deps.maxSamples ?? DEFAULT_MAX_SAMPLES);
  logger.info("performance sampling selected pages", {
    crawlId,
    candidateCount: pages.length,
    sampledCount: sampled.length,
  });

  for (const page of sampled) {
    await prisma.pagePerformance.upsert({
      where: { pageId: page.id },
      create: { pageId: page.id, status: "RUNNING" },
      update: { status: "RUNNING", errorMessage: null },
    });

    const result = await deps
      .collector(page.normalizedUrl, {
        timeoutMs: deps.timeoutPerPageMs ?? DEFAULT_TIMEOUT_MS,
        userAgent: deps.userAgent ?? DEFAULT_USER_AGENT,
      })
      .catch((error: unknown) => ({
        status: "FAILED" as const,
        errorMessage: error instanceof Error ? error.message : "Unknown performance analysis error",
      }));

    await prisma.pagePerformance.update({
      where: { pageId: page.id },
      data: {
        status: result.status,
        ttfbMs: "ttfbMs" in result ? result.ttfbMs : undefined,
        domContentLoadedMs: "domContentLoadedMs" in result ? result.domContentLoadedMs : undefined,
        loadTimeMs: "loadTimeMs" in result ? result.loadTimeMs : undefined,
        lcpMs: "lcpMs" in result ? result.lcpMs : undefined,
        cls: "cls" in result ? result.cls : undefined,
        errorMessage: result.errorMessage,
        analyzedAt: new Date(),
      },
    });

    logger.info("performance analysis finished for page", {
      crawlId,
      pageId: page.id,
      status: result.status,
    });
  }
}
