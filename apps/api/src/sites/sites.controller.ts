import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { SitesService } from "./sites.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";

@Controller("organizations/:organizationId/projects/:projectId/sites")
@UseGuards(OrgRolesGuard)
@RequireRole("MEMBER")
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Param("projectId") projectId: string) {
    return this.sitesService.list(organizationId, projectId);
  }

  @Post()
  create(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Body() dto: CreateSiteDto,
  ) {
    return this.sitesService.create(organizationId, projectId, dto);
  }

  @Get(":siteId")
  get(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
  ) {
    return this.sitesService.getOrThrow(organizationId, projectId, siteId);
  }

  @Patch(":siteId")
  update(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(organizationId, projectId, siteId, dto);
  }

  @Delete(":siteId")
  @RequireRole("ADMIN")
  remove(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
  ) {
    return this.sitesService.remove(organizationId, projectId, siteId);
  }
}
