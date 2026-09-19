import { Injectable, NotFoundException } from "@nestjs/common";
import type { EffortLevel, IssueCategory, IssueSeverity, Prisma } from "@searchenvil/database";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

export interface ListIssuesFilters {
  severity?: IssueSeverity[];
  category?: IssueCategory[];
  search?: string;
  sortBy?: "priority" | "severity" | "affectedPages";
  sortOrder?: "asc" | "desc";
}

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  NOTICE: 1,
};

/**
 * Issues are shown for a project's primary (first) site's latest completed
 * audit run — same "one primary site per project" scope as the Overview
 * dashboard (docs/progress/PHASE-09.md's known limitation note applies
 * here too).
 */
@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(organizationId: string, projectId: string, filters: ListIssuesFilters) {
    await this.projectsService.getOrThrow(organizationId, projectId);
    const auditRun = await this.findLatestAuditRun(projectId);
    if (!auditRun) return [];

    const where: Prisma.AuditIssueWhereInput = { auditRunId: auditRun.id };
    if (filters.severity?.length) where.severity = { in: filters.severity };
    if (filters.category?.length) where.rule = { category: { in: filters.category } };
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { summary: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const issues = await this.prisma.auditIssue.findMany({ where, include: { rule: true } });

    return this.sortIssues(issues, filters.sortBy ?? "priority", filters.sortOrder ?? "desc");
  }

  async getIssue(organizationId: string, projectId: string, issueId: string) {
    await this.projectsService.getOrThrow(organizationId, projectId);

    const issue = await this.prisma.auditIssue.findUnique({
      where: { id: issueId },
      include: {
        rule: true,
        occurrences: { include: { page: true } },
        auditRun: { include: { crawl: { include: { site: true } } } },
      },
    });

    if (!issue || issue.auditRun.crawl.site.projectId !== projectId) {
      throw new NotFoundException("Issue not found.");
    }

    return issue;
  }

  private async findLatestAuditRun(projectId: string) {
    const site = await this.prisma.site.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    if (!site) return null;

    const crawls = await this.prisma.crawl.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: "desc" },
      include: { auditRun: true },
    });
    const latestWithRun = crawls.find((c) => c.auditRun?.status === "COMPLETED");
    return latestWithRun?.auditRun ?? null;
  }

  private sortIssues<
    T extends { severity: IssueSeverity; effort: EffortLevel; affectedPageCount: number; priorityScore: number },
  >(issues: T[], sortBy: "priority" | "severity" | "affectedPages", sortOrder: "asc" | "desc"): T[] {
    const direction = sortOrder === "asc" ? 1 : -1;
    const sorted = [...issues].sort((a, b) => {
      if (sortBy === "severity") return (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) * direction;
      if (sortBy === "affectedPages") return (a.affectedPageCount - b.affectedPageCount) * direction;
      return (a.priorityScore - b.priorityScore) * direction;
    });
    return sorted;
  }
}
