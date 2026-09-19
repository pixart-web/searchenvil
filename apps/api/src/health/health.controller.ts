import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import IORedis from "ioredis";
import { PrismaService } from "../common/prisma/prisma.service";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(): Promise<{ status: "ok"; checks: Record<string, "ok" | "error"> }> {
    const checks: Record<string, "ok" | "error"> = { database: "error", redis: "error" };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 2000,
    });
    try {
      await redis.connect();
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    } finally {
      redis.disconnect();
    }

    const allOk = Object.values(checks).every((value) => value === "ok");
    if (!allOk) {
      throw new HttpException({ status: "error", checks }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return { status: "ok", checks };
  }
}
