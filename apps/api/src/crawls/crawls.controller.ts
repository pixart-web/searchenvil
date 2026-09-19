import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { CrawlsService } from "./crawls.service";
import { StartCrawlDto } from "./dto/start-crawl.dto";

@Controller("organizations/:organizationId/projects/:projectId/sites/:siteId/crawls")
@UseGuards(OrgRolesGuard)
@RequireRole("MEMBER")
export class CrawlsController {
  constructor(private readonly crawlsService: CrawlsService) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
  ) {
    return this.crawlsService.list(organizationId, projectId, siteId);
  }

  @Post()
  start(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Body() dto: StartCrawlDto,
  ) {
    return this.crawlsService.start(organizationId, projectId, siteId, dto);
  }

  @Get(":crawlId")
  get(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
  ) {
    return this.crawlsService.getOrThrow(organizationId, projectId, siteId, crawlId);
  }

  @Patch(":crawlId/cancel")
  cancel(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
  ) {
    return this.crawlsService.cancel(organizationId, projectId, siteId, crawlId);
  }

  @Get(":crawlId/pages")
  listPages(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.crawlsService.listPages(organizationId, projectId, siteId, crawlId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 25,
    });
  }

  @Get(":crawlId/pages/:pageId")
  getPage(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
    @Param("pageId") pageId: string,
  ) {
    return this.crawlsService.getPage(organizationId, projectId, siteId, crawlId, pageId);
  }
}
