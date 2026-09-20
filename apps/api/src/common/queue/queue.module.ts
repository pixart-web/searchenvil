import { Global, Module } from "@nestjs/common";
import { createTypedQueue, QUEUE_NAMES, type CrawlJobData } from "@searchanvil/queue";
import type { Queue } from "bullmq";

export const CRAWL_QUEUE = "CRAWL_QUEUE";

@Global()
@Module({
  providers: [
    {
      provide: CRAWL_QUEUE,
      useFactory: (): Queue<CrawlJobData> =>
        createTypedQueue(QUEUE_NAMES.CRAWL, process.env.REDIS_URL ?? "redis://localhost:6380"),
    },
  ],
  exports: [CRAWL_QUEUE],
})
export class QueueModule {}
