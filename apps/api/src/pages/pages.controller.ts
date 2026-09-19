import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { PagesService } from "./pages.service";
import { ListPagesQueryDto } from "./dto/list-pages-query.dto";

@Controller("organizations/:organizationId/projects/:projectId/pages")
@UseGuards(OrgRolesGuard)
@RequireRole("MEMBER")
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Query() query: ListPagesQueryDto,
  ) {
    return this.pagesService.list(organizationId, projectId, query);
  }

  @Get(":pageId")
  getPage(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("pageId") pageId: string,
  ) {
    return this.pagesService.getPage(organizationId, projectId, pageId);
  }
}
