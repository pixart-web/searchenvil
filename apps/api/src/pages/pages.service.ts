import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@searchenvil/database";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface ListPagesFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  indexableOnly?: boolean;
  statusClass?: "2xx" | "3xx" | "4xx" | "5xx";
}

const STATUS_RANGES: Record<NonNullable<ListPagesFilters["statusClass"]>, [number, number]> = {
  "2xx": [200, 299],
  "3xx": [300, 399],
  "4xx": [400, 499],
  "5xx": [500, 599],
};

/**
 * Pages are shown for a project's primary site's latest COMPLETED crawl —
 * same one-primary-site scope as Overview/Issues (docs/progress/PHASE-09.md).
 * Unlike Issues, this only needs a completed crawl, not a completed audit
 * run — page facts exist as soon as the crawl finishes.
 */
@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(organizationId: string, projectId: string, filters: ListPagesFilters) {
    await this.projectsService.getOrThrow(organizationId, projectId);
    const crawl = await this.findLatestCompletedCrawl(projectId);
    if (!crawl) {
      return { items: [], total: 0, page: 1, pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE, crawlId: null };
    }

    const where: Prisma.CrawlPageWhereInput = { crawlId: crawl.id };
    if (filters.search) {
      where.normalizedUrl = { contains: filters.search, mode: "insensitive" };
    }
    if (filters.indexableOnly) {
      where.isIndexable = true;
    }
    if (filters.statusClass) {
      const [min, max] = STATUS_RANGES[filters.statusClass];
      where.statusCode = { gte: min, lte: max };
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize || DEFAULT_PAGE_SIZE));

    const [items, total] = await Promise.all([
      this.prisma.crawlPage.findMany({
        where,
        orderBy: { normalizedUrl: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.crawlPage.count({ where }),
    ]);

    return { items, total, page, pageSize, crawlId: crawl.id };
  }

  async getPage(organizationId: string, projectId: string, pageId: string) {
    await this.projectsService.getOrThrow(organizationId, projectId);

    const page = await this.prisma.crawlPage.findUnique({
      where: { id: pageId },
      include: {
        images: true,
        structuredData: true,
        outboundLinks: true,
        crawl: { include: { site: true } },
      },
    });

    if (!page || page.crawl.site.projectId !== projectId) {
      throw new NotFoundException("Page not found.");
    }

    const [inboundLinkCount, auditRun] = await Promise.all([
      this.prisma.crawlLink.count({ where: { targetPageId: page.id } }),
      this.prisma.auditRun.findUnique({ where: { crawlId: page.crawlId } }),
    ]);

    const affectingIssues = auditRun
      ? await this.prisma.auditOccurrence.findMany({
          where: { pageId: page.id, auditIssue: { auditRunId: auditRun.id } },
          include: { auditIssue: { include: { rule: true } } },
        })
      : [];

    return {
      ...page,
      inboundLinkCount,
      issues: affectingIssues.map((occurrence) => ({
        id: occurrence.auditIssue.id,
        ruleKey: occurrence.auditIssue.rule.ruleKey,
        title: occurrence.auditIssue.title,
        severity: occurrence.auditIssue.severity,
        impact: occurrence.auditIssue.impact,
        evidence: occurrence.evidence,
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
