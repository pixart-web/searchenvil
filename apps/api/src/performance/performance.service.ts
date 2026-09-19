import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

/**
 * Performance is bounded/sampled by design (docs/PERFORMANCE.md) — a project
 * typically has a handful of PagePerformance rows, not one per crawled page.
 * This service surfaces exactly what was sampled; it never claims coverage
 * of the whole site.
 */
@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(organizationId: string, projectId: string) {
    await this.projectsService.getOrThrow(organizationId, projectId);
    const crawl = await this.findLatestCompletedCrawl(projectId);
    if (!crawl) {
      return { crawlId: null, totalPagesCrawled: 0, samples: [] };
    }

    const totalPagesCrawled = await this.prisma.crawlPage.count({ where: { crawlId: crawl.id } });

    const samples = await this.prisma.pagePerformance.findMany({
      where: { page: { crawlId: crawl.id } },
      include: { page: { select: { id: true, normalizedUrl: true, title: true } } },
      orderBy: { analyzedAt: "desc" },
    });

    return {
      crawlId: crawl.id,
      totalPagesCrawled,
      samples: samples.map((sample) => ({
        id: sample.id,
        status: sample.status,
        ttfbMs: sample.ttfbMs,
        domContentLoadedMs: sample.domContentLoadedMs,
        loadTimeMs: sample.loadTimeMs,
        lcpMs: sample.lcpMs,
        cls: sample.cls,
        errorMessage: sample.errorMessage,
        analyzedAt: sample.analyzedAt,
        page: sample.page,
      })),
    };
  }

  private async findLatestCompletedCrawl(projectId: string) {
    const site = await this.prisma.site.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    if (!site) return null;

    return this.prisma.crawl.findFirst({
      where: { siteId: site.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });
  }
}
