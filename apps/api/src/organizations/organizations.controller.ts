import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { OrgRolesGuard } from "../auth/guards/org-roles.guard";
import { RequireRole } from "../auth/decorators/require-role.decorator";
import { CurrentUser, type AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { OrganizationsService } from "./organizations.service";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

@Controller("organizations")
@UseGuards(OrgRolesGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listForUser(user.id);
  }

  @Get(":organizationId")
  @RequireRole("MEMBER")
  get(@Param("organizationId") organizationId: string) {
    return this.organizationsService.getById(organizationId);
  }

  @Get(":organizationId/members")
  @RequireRole("MEMBER")
  listMembers(@Param("organizationId") organizationId: string) {
    return this.organizationsService.listMembers(organizationId);
  }

  @Patch(":organizationId/members/:memberId")
  @RequireRole("ADMIN")
  updateMemberRole(
    @Param("organizationId") organizationId: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(organizationId, memberId, dto.role);
  }

  @Delete(":organizationId/members/:memberId")
  @RequireRole("ADMIN")
  removeMember(
    @Param("organizationId") organizationId: string,
    @Param("memberId") memberId: string,
  ) {
    return this.organizationsService.removeMember(organizationId, memberId);
  }
}
