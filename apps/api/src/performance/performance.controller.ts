import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { PerformanceService } from "./performance.service";

@Controller("organizations/:organizationId/projects/:projectId/performance")
@UseGuards(OrgRolesGuard)
@RequireRole("MEMBER")
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Param("projectId") projectId: string) {
    return this.performanceService.list(organizationId, projectId);
  }
}
