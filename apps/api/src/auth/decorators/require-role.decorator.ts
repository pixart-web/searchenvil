import { SetMetadata } from "@nestjs/common";
import type { OrganizationRole } from "@searchanvil/shared";

export const REQUIRED_ROLE_KEY = "requiredOrganizationRole";

/**
 * Minimum OrganizationRole required to hit this route. Combined with
 * OrgRolesGuard, which resolves the caller's membership for the
 * `:organizationId` route param and compares via `hasAtLeastRole`.
 */
export const RequireRole = (role: OrganizationRole): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_ROLE_KEY, role);
