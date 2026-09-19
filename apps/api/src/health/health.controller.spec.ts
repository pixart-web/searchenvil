import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";
import type { PrismaService } from "../common/prisma/prisma.service";

describe("HealthController", () => {
  it("reports ok on /health without touching dependencies", () => {
    const controller = new HealthController({} as PrismaService);
    expect(controller.health()).toEqual({ status: "ok" });
  });
});
