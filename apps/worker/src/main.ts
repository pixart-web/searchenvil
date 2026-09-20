import {
  createTypedQueue,
  createTypedWorker,
  QUEUE_NAMES,
  type AuditJobData,
  type CrawlJobData,
  type PerformanceJobData,
} from "@searchanvil/queue";
import { runCrawl } from "@searchanvil/crawler";
import { createPlaywrightCollector } from "@searchanvil/performance";
import { prisma } from "@searchanvil/database";
import { logger } from "./logger";
import { processCrawlJob } from "./crawl/process-crawl-job";
import { processAuditJob } from "./audit/process-audit-job";
import { processPerformanceJob } from "./performance/process-performance-job";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6380";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);
// Deliberately independent of, and much lower than, WORKER_CONCURRENCY — each
// performance job launches a real browser; see docs/PERFORMANCE.md for why
// this queue is bounded separately from crawl/audit.
const PERFORMANCE_CONCURRENCY = Number(process.env.PERFORMANCE_WORKER_CONCURRENCY ?? 1);
const CHROMIUM_EXECUTABLE_PATH = process.env.CHROMIUM_EXECUTABLE_PATH;

const auditQueue = createTypedQueue(QUEUE_NAMES.AUDIT, REDIS_URL);
const performanceQueue = createTypedQueue(QUEUE_NAMES.PERFORMANCE, REDIS_URL);

async function handleCrawlJob(job: { id?: string; data: CrawlJobData }): Promise<void> {
  logger.info("processing crawl job", { jobId: job.id, crawlId: job.data.crawlId });
  await processCrawlJob(
    {
      prisma,
      runCrawl,
      enqueueAuditJob: async (crawlId) => {
        await auditQueue.add("audit", { crawlId });
      },
      enqueuePerformanceJob: CHROMIUM_EXECUTABLE_PATH
        ? async (crawlId) => {
            await performanceQueue.add("performance", { crawlId });
          }
        : undefined,
    },
    job.data.crawlId,
  );
}

async function handleAuditJob(job: { id?: string; data: AuditJobData }): Promise<void> {
  logger.info("processing audit job", { jobId: job.id, crawlId: job.data.crawlId });
  await processAuditJob({ prisma }, job.data.crawlId);
}

async function handlePerformanceJob(job: { id?: string; data: PerformanceJobData }): Promise<void> {
  logger.info("processing performance job", { jobId: job.id, crawlId: job.data.crawlId });
  if (!CHROMIUM_EXECUTABLE_PATH) {
    logger.error("performance job skipped: CHROMIUM_EXECUTABLE_PATH not configured", {
      crawlId: job.data.crawlId,
    });
    return;
  }
  await processPerformanceJob(
    { prisma, collector: createPlaywrightCollector(CHROMIUM_EXECUTABLE_PATH) },
    job.data.crawlId,
  );
}

const crawlWorker = createTypedWorker(QUEUE_NAMES.CRAWL, REDIS_URL, handleCrawlJob, {
  concurrency: CONCURRENCY,
});
const auditWorker = createTypedWorker(QUEUE_NAMES.AUDIT, REDIS_URL, handleAuditJob, {
  concurrency: CONCURRENCY,
});
const performanceWorker = createTypedWorker(QUEUE_NAMES.PERFORMANCE, REDIS_URL, handlePerformanceJob, {
  concurrency: PERFORMANCE_CONCURRENCY,
});

crawlWorker.on("completed", (job) => {
  logger.info("crawl job completed", { jobId: job.id });
});
crawlWorker.on("failed", (job, error) => {
  logger.error("crawl job failed", { jobId: job?.id, error: error.message });
});
auditWorker.on("completed", (job) => {
  logger.info("audit job completed", { jobId: job.id });
});
auditWorker.on("failed", (job, error) => {
  logger.error("audit job failed", { jobId: job?.id, error: error.message });
});
performanceWorker.on("completed", (job) => {
  logger.info("performance job completed", { jobId: job.id });
});
performanceWorker.on("failed", (job, error) => {
  logger.error("performance job failed", { jobId: job?.id, error: error.message });
});

if (!CHROMIUM_EXECUTABLE_PATH) {
  logger.warn(
    "CHROMIUM_EXECUTABLE_PATH is not set — performance analysis is disabled for this worker instance (crawls/audits are unaffected). See docs/PERFORMANCE.md.",
  );
}

logger.info("worker started", {
  queues: [QUEUE_NAMES.CRAWL, QUEUE_NAMES.AUDIT, QUEUE_NAMES.PERFORMANCE],
  concurrency: CONCURRENCY,
  performanceConcurrency: PERFORMANCE_CONCURRENCY,
});

async function shutdown(signal: string): Promise<void> {
  logger.info("shutting down", { signal });
  await Promise.all([
    crawlWorker.close(),
    auditWorker.close(),
    performanceWorker.close(),
    auditQueue.close(),
    performanceQueue.close(),
  ]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
