import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { CrawlJobData } from "@searchenvil/queue";
import { DEFAULT_CRAWL_CONFIG } from "@searchenvil/crawler";
import { PrismaService } from "../common/prisma/prisma.service";
import { SitesService } from "../sites/sites.service";
import { CRAWL_QUEUE } from "../common/queue/queue.module";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class CrawlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sitesService: SitesService,
    @Inject(CRAWL_QUEUE) private readonly crawlQueue: Queue<CrawlJobData>,
  ) {}

  async start(
    organizationId: string,
    projectId: string,
    siteId: string,
    options: { maxPages?: number; maxDepth?: number },
  ) {
    await this.sitesService.getOrThrow(organizationId, projectId, siteId);

    const maxPages = options.maxPages ?? DEFAULT_CRAWL_CONFIG.maxPages;
    const maxDepth = options.maxDepth ?? DEFAULT_CRAWL_CONFIG.maxDepth;

    const crawl = await this.prisma.crawl.create({
      data: { siteId, status: "PENDING", config: {}, maxPages, maxDepth },
    });

    await this.crawlQueue.add("crawl", { crawlId: crawl.id });

    return crawl;
  }

  async list(organizationId: string, projectId: string, siteId: string) {
    await this.sitesService.getOrThrow(organizationId, projectId, siteId);
    return this.prisma.crawl.findMany({ where: { siteId }, orderBy: { createdAt: "desc" } });
  }

  async getOrThrow(organizationId: string, projectId: string, siteId: string, crawlId: string) {
    await this.sitesService.getOrThrow(organizationId, projectId, siteId);
    const crawl = await this.prisma.crawl.findUnique({ where: { id: crawlId } });
    if (!crawl || crawl.siteId !== siteId) {
      throw new NotFoundException("Crawl not found.");
    }
    return crawl;
  }

  async listPages(
    organizationId: string,
    projectId: string,
    siteId: string,
    crawlId: string,
    pagination: { page: number; pageSize: number },
  ) {
    await this.getOrThrow(organizationId, projectId, siteId, crawlId);

    const page = Math.max(1, pagination.page);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pagination.pageSize || DEFAULT_PAGE_SIZE));

    const [items, total] = await Promise.all([
      this.prisma.crawlPage.findMany({
        where: { crawlId },
        orderBy: { normalizedUrl: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.crawlPage.count({ where: { crawlId } }),
    ]);

    return { items, total, page, pageSize };
  }

  async getPage(
    organizationId: string,
    projectId: string,
    siteId: string,
    crawlId: string,
    pageId: string,
  ) {
    await this.getOrThrow(organizationId, projectId, siteId, crawlId);

    const page = await this.prisma.crawlPage.findUnique({
      where: { id: pageId },
      include: { images: true, structuredData: true, outboundLinks: true },
    });
    if (!page || page.crawlId !== crawlId) {
      throw new NotFoundException("Page not found.");
    }
    return page;
  }

  async cancel(organizationId: string, projectId: string, siteId: string, crawlId: string) {
    const crawl = await this.getOrThrow(organizationId, projectId, siteId, crawlId);

    const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
    if (terminalStatuses.has(crawl.status)) {
      return crawl;
    }

    return this.prisma.crawl.update({ where: { id: crawlId }, data: { status: "CANCELLED" } });
  }
}
