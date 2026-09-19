import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

/**
 * A Report is a deterministic, shareable snapshot of one crawl's Search
 * Health and issues — built entirely from already-stored AuditScore/
 * AuditIssue rows, same "no generated narrative" principle as Crawl
 * Comparison (docs/progress/PHASE-13.md). Scoped to the project's primary
 * site, same convention as Overview/Issues/Pages/Performance.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(organizationId: string, projectId: string) {
    await this.projectsService.getOrThrow(organizationId, projectId);
    const site = await this.findPrimarySite(projectId);
    if (!site) return [];

    const crawls = await this.prisma.crawl.findMany({
      where: { siteId: site.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      include: { auditRun: { include: { score: true } } },
    });

    return crawls
      .filter((crawl) => crawl.auditRun?.score)
      .map((crawl) => ({
        crawlId: crawl.id,
        finishedAt: crawl.finishedAt,
        pagesCrawled: crawl.pagesCrawled,
        overallScore: crawl.auditRun!.score!.overallScore,
      }));
  }

  async get(organizationId: string, projectId: string, crawlId: string) {
    await this.projectsService.getOrThrow(organizationId, projectId);
    const site = await this.findPrimarySite(projectId);
    if (!site) throw new NotFoundException("Report not found.");

    const crawl = await this.prisma.crawl.findUnique({
      where: { id: crawlId },
      include: { auditRun: { include: { score: true, issues: { include: { rule: true } } } } },
    });
    if (!crawl || crawl.siteId !== site.id || !crawl.auditRun?.score) {
      throw new NotFoundException("Report not found.");
    }

    const previousCrawl = await this.prisma.crawl.findFirst({
      where: { siteId: site.id, status: "COMPLETED", createdAt: { lt: crawl.createdAt } },
      orderBy: { createdAt: "desc" },
      include: { auditRun: { include: { score: true } } },
    });

    const issues = crawl.auditRun.issues
      .map((issue) => ({
        ruleKey: issue.rule.ruleKey,
        category: issue.rule.category,
        title: issue.title,
        summary: issue.summary,
        severity: issue.severity,
        impact: issue.impact,
        effort: issue.effort,
        affectedPageCount: issue.affectedPageCount,
        priorityScore: issue.priorityScore,
        recommendation: issue.rule.recommendation,
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      site: { id: site.id, displayName: site.displayName, rootUrl: site.rootUrl },
      crawl: {
        id: crawl.id,
        startedAt: crawl.startedAt,
        finishedAt: crawl.finishedAt,
        pagesCrawled: crawl.pagesCrawled,
      },
      score: {
        overallScore: crawl.auditRun.score.overallScore,
        categoryScores: crawl.auditRun.score.categoryScores,
      },
      previousCrawl:
        previousCrawl?.auditRun?.score
          ? {
              id: previousCrawl.id,
              finishedAt: previousCrawl.finishedAt,
              overallScore: previousCrawl.auditRun.score.overallScore,
            }
          : null,
      scoreDelta: previousCrawl?.auditRun?.score
        ? crawl.auditRun.score.overallScore - previousCrawl.auditRun.score.overallScore
        : null,
      issues,
    };
  }

  private async findPrimarySite(projectId: string) {
    return this.prisma.site.findFirst({ where: { projectId }, orderBy: { createdAt: "asc" } });
  }
}
