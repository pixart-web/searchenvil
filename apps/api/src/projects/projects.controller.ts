import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { ProjectsService } from "./projects.service";
import { ProjectOverviewService } from "./project-overview.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Controller("organizations/:organizationId/projects")
@UseGuards(OrgRolesGuard)
@RequireRole("MEMBER")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectOverviewService: ProjectOverviewService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string) {
    return this.projectsService.list(organizationId);
  }

  @Post()
  create(@Param("organizationId") organizationId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(organizationId, dto.name);
  }

  @Get(":projectId")
  get(@Param("organizationId") organizationId: string, @Param("projectId") projectId: string) {
    return this.projectsService.getOrThrow(organizationId, projectId);
  }

  @Get(":projectId/overview")
  getOverview(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.projectOverviewService.getOverview(organizationId, projectId);
  }

  @Patch(":projectId")
  update(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(organizationId, projectId, dto);
  }

  @Delete(":projectId")
  @RequireRole("ADMIN")
  remove(@Param("organizationId") organizationId: string, @Param("projectId") projectId: string) {
    return this.projectsService.remove(organizationId, projectId);
  }
}
