"use client";

import { usePathname } from "next/navigation";
import { AppShell, PROJECT_NAV_ITEMS, ProjectSwitcher } from "@searchanvil/ui";
import { NavLink } from "@/components/nav-link";

export default function ShellDemoLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();

  return (
    <AppShell
      sidebar={{
        items: PROJECT_NAV_ITEMS("demo"),
        currentPath: pathname,
        linkComponent: NavLink,
        header: <ProjectSwitcher currentProjectName="Demo Project" />,
      }}
      topbar={{
        right: (
          <span className="text-sm text-steel-400" aria-label="Signed in as demo user">
            demo@searchanvil.com
          </span>
        ),
      }}
    >
      {children}
    </AppShell>
  );
}
