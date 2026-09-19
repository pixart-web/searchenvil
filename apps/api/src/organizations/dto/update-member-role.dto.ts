import { IsIn } from "class-validator";
import type { OrganizationRole } from "@searchenvil/shared";

const ROLES: OrganizationRole[] = ["OWNER", "ADMIN", "MEMBER"];

export class UpdateMemberRoleDto {
  @IsIn(ROLES)
  role!: OrganizationRole;
}
