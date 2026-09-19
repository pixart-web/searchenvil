import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { IssuesService } from "./issues.service";
import { ListIssuesQueryDto } from "./dto/list-issues-query.dto";

@Controller("organizations/:organizationId/projects/:projectId/issues")
@UseGuards(OrgRolesGuard)
@RequireRole("MEMBER")
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Query() query: ListIssuesQueryDto,
  ) {
    return this.issuesService.list(organizationId, projectId, query);
  }

  @Get(":issueId")
  getIssue(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
  ) {
    return this.issuesService.getIssue(organizationId, projectId, issueId);
  }
}
