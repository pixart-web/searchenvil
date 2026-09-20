import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Site } from "@searchanvil/database";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(organizationId: string, projectId: string) {
    await this.projectsService.getOrThrow(organizationId, projectId);
    return this.prisma.site.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  }

  async getOrThrow(organizationId: string, projectId: string, siteId: string): Promise<Site> {
    await this.projectsService.getOrThrow(organizationId, projectId);
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.projectId !== projectId) {
      throw new NotFoundException("Site not found.");
    }
    return site;
  }

  async create(
    organizationId: string,
    projectId: string,
    data: { displayName: string; rootUrl: string },
  ): Promise<Site> {
    await this.projectsService.getOrThrow(organizationId, projectId);

    const existing = await this.prisma.site.findUnique({
      where: { projectId_rootUrl: { projectId, rootUrl: data.rootUrl } },
    });
    if (existing) {
      throw new ConflictException("This website is already added to the project.");
    }

    return this.prisma.site.create({ data: { projectId, ...data } });
  }

  async update(
    organizationId: string,
    projectId: string,
    siteId: string,
    data: { displayName?: string; rootUrl?: string },
  ): Promise<Site> {
    await this.getOrThrow(organizationId, projectId, siteId);
    return this.prisma.site.update({ where: { id: siteId }, data });
  }

  async remove(organizationId: string, projectId: string, siteId: string): Promise<void> {
    await this.getOrThrow(organizationId, projectId, siteId);
    await this.prisma.site.delete({ where: { id: siteId } });
  }
}
