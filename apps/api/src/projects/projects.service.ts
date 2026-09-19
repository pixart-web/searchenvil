import { Injectable, NotFoundException } from "@nestjs/common";
import type { Project } from "@searchenvil/database";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { sites: true } } },
    });
  }

  async getOrThrow(organizationId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    // Scoping by organizationId here (not just id) is what stops a member of
    // one org from reading another org's project by guessing/enumerating IDs.
    if (!project || project.organizationId !== organizationId) {
      throw new NotFoundException("Project not found.");
    }
    return project;
  }

  create(organizationId: string, name: string): Promise<Project> {
    return this.prisma.project.create({ data: { organizationId, name } });
  }

  async update(
    organizationId: string,
    projectId: string,
    data: { name?: string },
  ): Promise<Project> {
    await this.getOrThrow(organizationId, projectId);
    return this.prisma.project.update({ where: { id: projectId }, data });
  }

  async remove(organizationId: string, projectId: string): Promise<void> {
    await this.getOrThrow(organizationId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }
}
