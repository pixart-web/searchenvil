import { createTypedWorker, QUEUE_NAMES, type CrawlJobData } from "@searchenvil/queue";
import { runCrawl } from "@searchenvil/crawler";
import { prisma } from "@searchenvil/database";
import { logger } from "./logger";
import { processCrawlJob } from "./crawl/process-crawl-job";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6380";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

async function handleCrawlJob(job: { id?: string; data: CrawlJobData }): Promise<void> {
  logger.info("processing crawl job", { jobId: job.id, crawlId: job.data.crawlId });
  await processCrawlJob({ prisma, runCrawl }, job.data.crawlId);
}

const crawlWorker = createTypedWorker(QUEUE_NAMES.CRAWL, REDIS_URL, handleCrawlJob, {
  concurrency: CONCURRENCY,
});

crawlWorker.on("completed", (job) => {
  logger.info("crawl job completed", { jobId: job.id });
});

crawlWorker.on("failed", (job, error) => {
  logger.error("crawl job failed", { jobId: job?.id, error: error.message });
});

logger.info("worker started", { queues: [QUEUE_NAMES.CRAWL], concurrency: CONCURRENCY });

async function shutdown(signal: string): Promise<void> {
  logger.info("shutting down", { signal });
  await crawlWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
