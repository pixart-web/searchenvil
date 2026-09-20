import { Controller, Get, Header, Param, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { ReportsService } from "./reports.service";
import { toCsv } from "./csv.util";

@Controller("organizations/:organizationId/projects/:projectId/reports")
@UseGuards(OrgRolesGuard)
@RequireRole("MEMBER")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Param("projectId") projectId: string) {
    return this.reportsService.list(organizationId, projectId);
  }

  @Get(":crawlId")
  get(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("crawlId") crawlId: string,
  ) {
    return this.reportsService.get(organizationId, projectId, crawlId);
  }

  @Get(":crawlId/export.csv")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="searchanvil-report.csv"')
  async exportCsv(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("crawlId") crawlId: string,
  ) {
    const report = await this.reportsService.get(organizationId, projectId, crawlId);
    return toCsv(
      ["Rule Key", "Category", "Severity", "Impact", "Effort", "Affected Pages", "Priority Score", "Title", "Recommendation"],
      report.issues.map((issue) => [
        issue.ruleKey,
        issue.category,
        issue.severity,
        issue.impact,
        issue.effort,
        issue.affectedPageCount,
        issue.priorityScore,
        issue.title,
        issue.recommendation,
      ]),
    );
  }
}
