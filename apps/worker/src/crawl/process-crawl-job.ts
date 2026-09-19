import type { CrawlConfig, CrawlResult, RunCrawlOptions } from "@searchenvil/crawler";
import type { PrismaClient } from "@searchenvil/database";
import { DEFAULT_CRAWL_CONFIG } from "@searchenvil/crawler";
import { finalizeCrawlLinks, persistCrawlPage } from "./persist-crawl-result";
import { logger } from "../logger";

export interface ProcessCrawlJobDeps {
  prisma: PrismaClient;
  runCrawl: (config: CrawlConfig, options: RunCrawlOptions) => Promise<CrawlResult>;
  /** How often to re-check whether the crawl has been cancelled, in ms. */
  cancellationCheckIntervalMs?: number;
}

/**
 * Orchestrates one crawl end to end: loads the Crawl+Site, transitions
 * status, runs the actual crawl (via the injected `runCrawl` — production
 * wiring uses the real @searchenvil/crawler; tests inject a fixture), persists
 * pages incrementally as they complete, resolves links once everything is
 * in, and leaves the Crawl in a terminal state (COMPLETED/FAILED/CANCELLED)
 * with startedAt/finishedAt/errorMessage set appropriately.
 */
export async function processCrawlJob(deps: ProcessCrawlJobDeps, crawlId: string): Promise<void> {
  const { prisma } = deps;

  const crawl = await prisma.crawl.findUnique({ where: { id: crawlId }, include: { site: true } });
  if (!crawl) {
    logger.error("crawl not found", { crawlId });
    return;
  }
  if (crawl.status === "CANCELLED") {
    logger.info("crawl already cancelled before processing started", { crawlId });
    return;
  }

  const controller = new AbortController();
  const cancellationInterval = setInterval(() => {
    void prisma.crawl
      .findUnique({ where: { id: crawlId }, select: { status: true } })
      .then((current) => {
        if (current?.status === "CANCELLED") {
          controller.abort();
        }
      })
      .catch(() => {
        // A transient DB error here shouldn't abort an otherwise-healthy crawl.
      });
  }, deps.cancellationCheckIntervalMs ?? 2000);

  try {
    await prisma.crawl.update({
      where: { id: crawlId },
      data: { status: "DISCOVERING", startedAt: new Date() },
    });

    const configJson = crawl.config as Partial<CrawlConfig> | null;
    const config: CrawlConfig = {
      ...DEFAULT_CRAWL_CONFIG,
      ...configJson,
      startUrl: crawl.site.rootUrl,
      maxPages: crawl.maxPages,
      maxDepth: crawl.maxDepth,
    };

    await prisma.crawl.update({ where: { id: crawlId }, data: { status: "CRAWLING" } });

    const persistPromises: Promise<string | void>[] = [];
    const result = await deps.runCrawl(config, {
      signal: controller.signal,
      onPageCrawled: (page) => {
        persistPromises.push(
          persistCrawlPage(prisma, crawlId, page).catch((error) => {
            logger.error("failed to persist crawl page", {
              crawlId,
              url: page.normalizedUrl,
              error: error instanceof Error ? error.message : String(error),
            });
          }),
        );
      },
    });

    // All page rows must exist before link target resolution can be correct.
    await Promise.all(persistPromises);
    await finalizeCrawlLinks(prisma, crawlId, result.pages);

    const finalStatus = controller.signal.aborted ? "CANCELLED" : "COMPLETED";
    await prisma.crawl.update({
      where: { id: crawlId },
      data: { status: finalStatus, finishedAt: new Date() },
    });

    logger.info("crawl finished", { crawlId, status: finalStatus, pagesCrawled: result.pages.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("crawl failed", { crawlId, error: message });
    await prisma.crawl.update({
      where: { id: crawlId },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
    });
  } finally {
    clearInterval(cancellationInterval);
  }
}
