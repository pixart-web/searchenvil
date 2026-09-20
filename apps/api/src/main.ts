import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import helmet from "helmet";
import type { Queue } from "bullmq";
import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";
import { CRAWL_QUEUE } from "./common/queue/queue.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });
  configureApp(app);

  // Not using app.enableShutdownHooks() — it would install its own SIGTERM/SIGINT listeners
  // alongside registerGracefulShutdown's, double-handling the same signal. Calling app.close()
  // ourselves below still runs every OnModuleDestroy hook (e.g. PrismaService) exactly the same
  // way; we just also explicitly close CRAWL_QUEUE, which enableShutdownHooks alone would miss.
  registerGracefulShutdown(app);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SearchAnvil API listening on :${port}`);
}

/**
 * `app.enableShutdownHooks()` closes every provider that implements
 * `OnModuleDestroy` (e.g. PrismaService), but the CRAWL_QUEUE provider is a
 * plain BullMQ Queue value with its own open ioredis connection — nothing
 * closes it, which keeps the event loop alive indefinitely after
 * `app.close()` resolves and the process never exits on its own, forcing
 * `docker stop` to SIGKILL it after its grace period (found via an actual
 * container smoke test during SA-RC21, not by inspection). Closing it
 * explicitly, then calling process.exit(), fixes that. A 10s hard-exit
 * fallback guards against anything else unexpectedly hanging.
 */
function registerGracefulShutdown(app: INestApplication): void {
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down gracefully...`);

    const hardExitTimer = setTimeout(() => process.exit(1), 10_000);
    hardExitTimer.unref();

    try {
      const crawlQueue = app.get<Queue>(CRAWL_QUEUE);
      await Promise.all([app.close(), crawlQueue.close()]);
      process.exit(0);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error during shutdown", error);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error during bootstrap", error);
  process.exit(1);
});
