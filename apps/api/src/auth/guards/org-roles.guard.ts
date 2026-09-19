import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAtLeastRole, type OrganizationRole } from "@searchenvil/shared";
import type { Request } from "express";
import { PrismaService } from "../../common/prisma/prisma.service";
import { REQUIRED_ROLE_KEY } from "../decorators/require-role.decorator";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

/**
 * Enforces organization-scoped authorization server-side: re-derives the
 * caller's membership role for the `:organizationId` route param on every
 * request rather than trusting anything the client claims. This is what
 * actually stops cross-tenant access — never rely on the frontend alone.
 */
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<OrganizationRole | undefined>(
      REQUIRED_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const organizationId = request.params.organizationId;
    if (!organizationId) {
      throw new ForbiddenException("Organization context is required for this route.");
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: request.user.id } },
    });

    if (!membership || !hasAtLeastRole(membership.role, requiredRole)) {
      // Deliberately the same error whether the org doesn't exist, the user
      // isn't a member, or the role is insufficient — never leak which case
      // it is to an unauthorized caller.
      throw new ForbiddenException("You do not have access to this organization.");
    }

    return true;
  }
}
