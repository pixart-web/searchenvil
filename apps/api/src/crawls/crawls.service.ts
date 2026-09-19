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

  async getScore(organizationId: string, projectId: string, siteId: string, crawlId: string) {
    await this.getOrThrow(organizationId, projectId, siteId, crawlId);
    const auditRun = await this.prisma.auditRun.findUnique({ where: { crawlId }, include: { score: true } });
    if (!auditRun?.score) {
      throw new NotFoundException("No Search Health score available for this crawl yet.");
    }
    return auditRun.score;
  }

  async listIssues(organizationId: string, projectId: string, siteId: string, crawlId: string) {
    await this.getOrThrow(organizationId, projectId, siteId, crawlId);
    const auditRun = await this.prisma.auditRun.findUnique({ where: { crawlId } });
    if (!auditRun) {
      return [];
    }
    return this.prisma.auditIssue.findMany({
      where: { auditRunId: auditRun.id },
      include: { rule: true },
      orderBy: { priorityScore: "desc" },
    });
  }

  async getIssue(
    organizationId: string,
    projectId: string,
    siteId: string,
    crawlId: string,
    issueId: string,
  ) {
    await this.getOrThrow(organizationId, projectId, siteId, crawlId);
    const auditRun = await this.prisma.auditRun.findUnique({ where: { crawlId } });
    const issue = auditRun
      ? await this.prisma.auditIssue.findUnique({
          where: { id: issueId },
          include: { rule: true, occurrences: { include: { page: true } } },
        })
      : null;
    if (!issue || issue.auditRunId !== auditRun?.id) {
      throw new NotFoundException("Issue not found.");
    }
    return issue;
  }

  /**
   * "Did the website improve since the previous audit?" (docs/PRODUCT.md, question 5). Compares
   * `crawlId` against either an explicit `baselineCrawlId` or, when omitted, the most recent
   * COMPLETED crawl of the same site that finished before it. Everything returned is derived from
   * already-stored AuditScore/AuditIssue/AuditOccurrence rows — no re-running the audit engine,
   * no generated narrative, per docs/PRODUCT.md's "deterministic stored data, never a generated
   * narrative guess."
   */
  async compare(
    organizationId: string,
    projectId: string,
    siteId: string,
    crawlId: string,
    baselineCrawlId?: string,
  ) {
    const current = await this.getOrThrow(organizationId, projectId, siteId, crawlId);

    const baseline = baselineCrawlId
      ? await this.getOrThrow(organizationId, projectId, siteId, baselineCrawlId)
      : await this.prisma.crawl.findFirst({
          where: { siteId, status: "COMPLETED", createdAt: { lt: current.createdAt } },
          orderBy: { createdAt: "desc" },
        });

    if (!baseline) {
      throw new NotFoundException("No earlier completed crawl available to compare against.");
    }
    if (baseline.id === current.id) {
      throw new NotFoundException("Cannot compare a crawl against itself.");
    }

    const [currentRun, baselineRun] = await Promise.all([
      this.prisma.auditRun.findUnique({
        where: { crawlId: current.id },
        include: { score: true, issues: { include: { rule: true, occurrences: true } } },
      }),
      this.prisma.auditRun.findUnique({
        where: { crawlId: baseline.id },
        include: { score: true, issues: { include: { rule: true, occurrences: true } } },
      }),
    ]);

    if (!currentRun?.score || !baselineRun?.score) {
      throw new NotFoundException("Both crawls must have a completed audit with a score to compare.");
    }

    const currentScores = currentRun.score.categoryScores as Record<string, number>;
    const baselineScores = baselineRun.score.categoryScores as Record<string, number>;
    const allCategories = new Set([...Object.keys(currentScores), ...Object.keys(baselineScores)]);
    const categoryDeltas: Record<string, number | null> = {};
    for (const category of allCategories) {
      const c = currentScores[category];
      const b = baselineScores[category];
      categoryDeltas[category] = c !== undefined && b !== undefined ? c - b : null;
    }

    const baselineRuleKeys = new Set(baselineRun.issues.map((i) => i.rule.ruleKey));
    const currentRuleKeys = new Set(currentRun.issues.map((i) => i.rule.ruleKey));

    const summarizeIssue = (issue: (typeof currentRun.issues)[number]) => ({
      ruleKey: issue.rule.ruleKey,
      title: issue.title,
      severity: issue.severity,
      impact: issue.impact,
      affectedPageCount: issue.affectedPageCount,
      priorityScore: issue.priorityScore,
    });

    const newIssues = currentRun.issues
      .filter((i) => !baselineRuleKeys.has(i.rule.ruleKey))
      .map(summarizeIssue);
    const resolvedIssues = baselineRun.issues
      .filter((i) => !currentRuleKeys.has(i.rule.ruleKey))
      .map(summarizeIssue);
    const persistingIssues = currentRun.issues
      .filter((i) => baselineRuleKeys.has(i.rule.ruleKey))
      .map(summarizeIssue);

    const [currentPages, baselinePages] = await Promise.all([
      this.prisma.crawlPage.findMany({
        where: { crawlId: current.id },
        select: { id: true, normalizedUrl: true },
      }),
      this.prisma.crawlPage.findMany({
        where: { crawlId: baseline.id },
        select: { id: true, normalizedUrl: true },
      }),
    ]);

    const countIssuesByPageId = (issues: typeof currentRun.issues): Map<string, number> => {
      const counts = new Map<string, number>();
      for (const issue of issues) {
        for (const occurrence of issue.occurrences) {
          counts.set(occurrence.pageId, (counts.get(occurrence.pageId) ?? 0) + 1);
        }
      }
      return counts;
    };
    const currentIssueCounts = countIssuesByPageId(currentRun.issues);
    const baselineIssueCounts = countIssuesByPageId(baselineRun.issues);

    const baselineUrlToId = new Map(baselinePages.map((p) => [p.normalizedUrl, p.id]));
    const currentUrlToId = new Map(currentPages.map((p) => [p.normalizedUrl, p.id]));

    const improvedPages: { url: string; baselineIssueCount: number; currentIssueCount: number }[] = [];
    const worsenedPages: { url: string; baselineIssueCount: number; currentIssueCount: number }[] = [];

    for (const [url, currentPageId] of currentUrlToId) {
      const baselinePageId = baselineUrlToId.get(url);
      if (!baselinePageId) continue; // only matched (present in both crawls) URLs are comparable

      const currentCount = currentIssueCounts.get(currentPageId) ?? 0;
      const baselineCount = baselineIssueCounts.get(baselinePageId) ?? 0;
      if (currentCount < baselineCount) {
        improvedPages.push({ url, baselineIssueCount: baselineCount, currentIssueCount: currentCount });
      } else if (currentCount > baselineCount) {
        worsenedPages.push({ url, baselineIssueCount: baselineCount, currentIssueCount: currentCount });
      }
    }
    improvedPages.sort(
      (a, b) => b.baselineIssueCount - b.currentIssueCount - (a.baselineIssueCount - a.currentIssueCount),
    );
    worsenedPages.sort(
      (a, b) => b.currentIssueCount - b.baselineIssueCount - (a.currentIssueCount - a.baselineIssueCount),
    );

    const matchedUrlCount = [...currentUrlToId.keys()].filter((url) => baselineUrlToId.has(url)).length;

    return {
      baseline: {
        crawlId: baseline.id,
        finishedAt: baseline.finishedAt,
        overallScore: baselineRun.score.overallScore,
        categoryScores: baselineScores,
      },
      current: {
        crawlId: current.id,
        finishedAt: current.finishedAt,
        overallScore: currentRun.score.overallScore,
        categoryScores: currentScores,
      },
      scoreDelta: currentRun.score.overallScore - baselineRun.score.overallScore,
      categoryDeltas,
      issues: { new: newIssues, resolved: resolvedIssues, persisting: persistingIssues },
      pages: {
        matchedUrlCount,
        newPageCount: currentPages.length - matchedUrlCount,
        removedPageCount: baselinePages.length - matchedUrlCount,
        improved: improvedPages,
        worsened: worsenedPages,
      },
    };
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
