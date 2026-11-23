import type { PrismaClient } from "@searchanvil/database";
import { RULESET_VERSION } from "@searchanvil/audit-engine";

export const INTERRUPTED = "Interrupted by a local runtime shutdown.";

export async function reconcileDesktopWork(prisma: PrismaClient): Promise<void> {
  const finishedAt = new Date();
  await prisma.$transaction([
    prisma.crawl.updateMany({
      where: { status: { in: ["DISCOVERING", "CRAWLING", "ANALYZING", "SCORING"] } },
      data: { status: "FAILED", finishedAt, errorMessage: INTERRUPTED },
    }),
    prisma.auditScore.deleteMany({
      where: { auditRun: { status: { in: ["PENDING", "RUNNING"] } } },
    }),
    prisma.auditIssue.deleteMany({
      where: { auditRun: { status: { in: ["PENDING", "RUNNING"] } } },
    }),
    prisma.auditRun.updateMany({
      where: { status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "FAILED", finishedAt, errorMessage: INTERRUPTED },
    }),
    prisma.auditRun.createMany({
      data: (
        await prisma.crawl.findMany({
          where: { status: "COMPLETED", auditRun: null },
          select: { id: true },
        })
      ).map(({ id }) => ({
        crawlId: id,
        rulesetVersion: RULESET_VERSION,
        status: "FAILED",
        finishedAt,
        errorMessage: INTERRUPTED,
      })),
      skipDuplicates: true,
    }),
    prisma.pagePerformance.updateMany({
      where: { status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "FAILED", analyzedAt: finishedAt, errorMessage: INTERRUPTED },
    }),
  ]);
}
