import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationMember, OrganizationRole } from "@searchenvil/database";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({ ...m.organization, myRole: m.role }));
  }

  async getById(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException("Organization not found.");
    }
    return org;
  }

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMember> {
    const member = await this.prisma.organizationMember.findUnique({ where: { id: memberId } });
    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException("Membership not found.");
    }

    if (member.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await this.prisma.organizationMember.count({
        where: { organizationId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException("An organization must keep at least one OWNER.");
      }
    }

    return this.prisma.organizationMember.update({ where: { id: memberId }, data: { role } });
  }

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({ where: { id: memberId } });
    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException("Membership not found.");
    }

    if (member.role === "OWNER") {
      const ownerCount = await this.prisma.organizationMember.count({
        where: { organizationId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException("An organization must keep at least one OWNER.");
      }
    }

    await this.prisma.organizationMember.delete({ where: { id: memberId } });
  }
}
