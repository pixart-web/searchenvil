export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";

/**
 * Ordered from least to most privileged so `hasAtLeastRole` can compare by index.
 * Adding a role later only requires inserting it in the correct rank position.
 */
const ROLE_RANK: readonly OrganizationRole[] = ["MEMBER", "ADMIN", "OWNER"];

export function hasAtLeastRole(actual: OrganizationRole, required: OrganizationRole): boolean {
  return ROLE_RANK.indexOf(actual) >= ROLE_RANK.indexOf(required);
}

export const PERMISSIONS = {
  ORGANIZATION_MANAGE_MEMBERS: "ADMIN",
  ORGANIZATION_MANAGE_BILLING: "OWNER",
  ORGANIZATION_DELETE: "OWNER",
  PROJECT_CREATE: "MEMBER",
  PROJECT_DELETE: "ADMIN",
  SITE_MANAGE: "MEMBER",
  CRAWL_START: "MEMBER",
  CRAWL_CANCEL: "MEMBER",
} as const satisfies Record<string, OrganizationRole>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: OrganizationRole, permission: Permission): boolean {
  return hasAtLeastRole(role, PERMISSIONS[permission]);
}
