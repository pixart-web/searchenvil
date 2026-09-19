"use client";

import { use, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell, PROJECT_NAV_ITEMS, ProjectSwitcher } from "@searchenvil/ui";
import { NavLink } from "@/components/nav-link";
import { apiFetch } from "@/lib/api-client";
import type { Project } from "@/lib/types";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const pathname = usePathname();
  const { projectId } = use(params);
  const [projectName, setProjectName] = useState("Project");

  useEffect(() => {
    // The project's organizationId isn't in the URL; org membership is
    // already enforced server-side regardless, so we only need it here to
    // build the request path. A dedicated "my projects" lookup lands with
    // the Phase 09 dashboard — for now this mirrors what onboarding already
    // knows and re-fetches organizations to find the right one.
    let cancelled = false;
    async function loadProjectName(): Promise<void> {
      try {
        const orgs = await apiFetch<{ id: string }[]>("/organizations");
        for (const org of orgs) {
          try {
            const project = await apiFetch<Project>(
              `/organizations/${org.id}/projects/${projectId}`,
            );
            if (!cancelled) {
              setProjectName(project.name);
            }
            return;
          } catch {
            // Not in this org — try the next one.
          }
        }
      } catch {
        // Left as the "Project" fallback; the page body will show the real error state.
      }
    }
    void loadProjectName();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <AppShell
      sidebar={{
        items: PROJECT_NAV_ITEMS(projectId),
        currentPath: pathname,
        linkComponent: NavLink,
        header: <ProjectSwitcher currentProjectName={projectName} />,
      }}
      topbar={{}}
    >
      {children}
    </AppShell>
  );
}
