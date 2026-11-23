"use client";

import { use, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, PROJECT_NAV_ITEMS, ProjectSwitcher } from "@searchanvil/ui";
import { DesktopShell } from "@/components/desktop-shell";
import { NavLink } from "@/components/nav-link";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import type { ProjectOverview } from "@/lib/types";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { projectId } = use(params);
  const [overview, setOverview] = useState<ProjectOverview>();
  const projectName = overview?.project.name ?? "Project";

  useEffect(() => {
    let cancelled = false;
    resolveProjectOrg(projectId, (orgId) =>
      apiFetch<ProjectOverview>(`/organizations/${orgId}/projects/${projectId}/overview`),
    )
      .then((project) => {
        if (!cancelled) setOverview(project);
      })
      .catch(() => {
        // Left as the "Project" fallback; the page body shows the real error state.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (process.env.NEXT_PUBLIC_SEARCHANVIL_DESKTOP === "1") {
    return (
      <DesktopShell
        projectName={projectName}
        target={overview?.sites[0]?.rootUrl}
        items={PROJECT_NAV_ITEMS(projectId)}
        pathname={pathname}
      >
        {children}
      </DesktopShell>
    );
  }

  return (
    <AppShell
      sidebar={{
        items: PROJECT_NAV_ITEMS(projectId),
        currentPath: pathname,
        linkComponent: NavLink,
        header: (
          <ProjectSwitcher
            currentProjectName={projectName}
            onOpen={() => router.push("/app/projects")}
          />
        ),
      }}
      topbar={{}}
    >
      {children}
    </AppShell>
  );
}
