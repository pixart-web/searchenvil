import { apiFetch } from "./api-client";

/**
 * The URL space doesn't carry an organizationId (routes are
 * /app/projects/:projectId), but every API call needs one. Organization
 * membership/authorization is enforced server-side regardless (see
 * docs/SECURITY.md) — this just finds which of the caller's orgs owns the
 * project, trying each in turn. Fine at "a user belongs to a small number
 * of orgs" scale; see docs/progress/PHASE-09.md's known-limitation note.
 */
export async function resolveProjectOrg<T>(
  projectId: string,
  fetchForOrg: (organizationId: string) => Promise<T>,
): Promise<T> {
  const orgs = await apiFetch<{ id: string }[]>("/organizations");
  for (const org of orgs) {
    try {
      return await fetchForOrg(org.id);
    } catch {
      // Not in this org — try the next one.
    }
  }
  throw new Error(`Project ${projectId} not found in any of the caller's organizations.`);
}
