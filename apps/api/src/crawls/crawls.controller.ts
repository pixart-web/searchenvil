import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { CrawlsService } from "./crawls.service";
import { StartCrawlDto } from "./dto/start-crawl.dto";
import { ListCrawlPagesQueryDto } from "./dto/list-crawl-pages-query.dto";
import { CompareCrawlQueryDto } from "./dto/compare-crawl-query.dto";

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
    @Query() query: ListCrawlPagesQueryDto,
  ) {
    return this.crawlsService.listPages(organizationId, projectId, siteId, crawlId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  }

  @Get(":crawlId/score")
  getScore(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
  ) {
    return this.crawlsService.getScore(organizationId, projectId, siteId, crawlId);
  }

  @Get(":crawlId/issues")
  listIssues(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
  ) {
    return this.crawlsService.listIssues(organizationId, projectId, siteId, crawlId);
  }

  @Get(":crawlId/issues/:issueId")
  getIssue(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
    @Param("issueId") issueId: string,
  ) {
    return this.crawlsService.getIssue(organizationId, projectId, siteId, crawlId, issueId);
  }

  @Get(":crawlId/compare")
  compare(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Param("siteId") siteId: string,
    @Param("crawlId") crawlId: string,
    @Query() query: CompareCrawlQueryDto,
  ) {
    return this.crawlsService.compare(organizationId, projectId, siteId, crawlId, query.baselineCrawlId);
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
