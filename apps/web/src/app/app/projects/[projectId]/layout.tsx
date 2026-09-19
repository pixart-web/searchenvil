"use client";

import { use, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell, PROJECT_NAV_ITEMS, ProjectSwitcher } from "@searchenvil/ui";
import { NavLink } from "@/components/nav-link";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
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
    let cancelled = false;
    resolveProjectOrg(projectId, (orgId) =>
      apiFetch<Project>(`/organizations/${orgId}/projects/${projectId}`),
    )
      .then((project) => {
        if (!cancelled) setProjectName(project.name);
      })
      .catch(() => {
        // Left as the "Project" fallback; the page body shows the real error state.
      });
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
