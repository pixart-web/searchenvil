import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProjectsService } from "./projects.service";

const RECENT_CRAWLS_LIMIT = 10;
const TOP_ISSUES_LIMIT = 5;

/**
 * Aggregates everything the Overview dashboard needs into one call, so the
 * frontend isn't left doing an N+1 waterfall (site -> latest crawl -> score
 * -> issues) itself. Each project currently has at most a handful of sites
 * (onboarding creates exactly one) — see docs/progress/PHASE-09.md for the
 * known multi-site scaling note.
 */
@Injectable()
export class ProjectOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getOverview(organizationId: string, projectId: string) {
    const project = await this.projectsService.getOrThrow(organizationId, projectId);
    const sites = await this.prisma.site.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    const siteOverviews = await Promise.all(sites.map((site) => this.buildSiteOverview(site.id)));

    return {
      project: { id: project.id, name: project.name },
      sites: sites.map((site, index) => ({
        id: site.id,
        displayName: site.displayName,
        rootUrl: site.rootUrl,
        ...siteOverviews[index],
      })),
    };
  }

  private async buildSiteOverview(siteId: string) {
    const recentCrawls = await this.prisma.crawl.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: RECENT_CRAWLS_LIMIT,
      include: { auditRun: { include: { score: true } } },
    });

    const recentCrawlSummaries = recentCrawls.map((crawl) => ({
      id: crawl.id,
      status: crawl.status,
      createdAt: crawl.createdAt,
      startedAt: crawl.startedAt,
      finishedAt: crawl.finishedAt,
      pagesCrawled: crawl.pagesCrawled,
      overallScore: crawl.auditRun?.score?.overallScore ?? null,
    }));

    const latestScoredCrawl = recentCrawls.find((crawl) => crawl.auditRun?.score);
    if (!latestScoredCrawl?.auditRun?.score) {
      return { latestCrawl: null, recentCrawls: recentCrawlSummaries };
    }

    const topIssues = await this.prisma.auditIssue.findMany({
      where: { auditRunId: latestScoredCrawl.auditRun.id },
      include: { rule: true },
      orderBy: { priorityScore: "desc" },
      take: TOP_ISSUES_LIMIT,
    });

    const issueCategoryCounts = await this.prisma.auditIssue.groupBy({
      by: ["severity"],
      where: { auditRunId: latestScoredCrawl.auditRun.id },
      _count: true,
    });

    const categoryBreakdown = await this.prisma.auditIssue.findMany({
      where: { auditRunId: latestScoredCrawl.auditRun.id },
      include: { rule: { select: { category: true } } },
    });
    const issuesByCategory: Record<string, number> = {};
    for (const issue of categoryBreakdown) {
      issuesByCategory[issue.rule.category] = (issuesByCategory[issue.rule.category] ?? 0) + 1;
    }

    return {
      latestCrawl: {
        id: latestScoredCrawl.id,
        status: latestScoredCrawl.status,
        startedAt: latestScoredCrawl.startedAt,
        finishedAt: latestScoredCrawl.finishedAt,
        pagesCrawled: latestScoredCrawl.pagesCrawled,
        score: {
          overallScore: latestScoredCrawl.auditRun.score.overallScore,
          categoryScores: latestScoredCrawl.auditRun.score.categoryScores,
        },
        issuesBySeverity: Object.fromEntries(
          issueCategoryCounts.map((row) => [row.severity, row._count]),
        ),
        issuesByCategory,
        topIssues: topIssues.map((issue) => ({
          id: issue.id,
          ruleKey: issue.rule.ruleKey,
          title: issue.title,
          severity: issue.severity,
          impact: issue.impact,
          effort: issue.effort,
          affectedPageCount: issue.affectedPageCount,
          priorityScore: issue.priorityScore,
        })),
      },
      recentCrawls: recentCrawlSummaries,
    };
  }
}
