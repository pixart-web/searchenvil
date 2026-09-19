import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent, type NavItemDefinition } from "./types";

export interface SidebarProps {
  items: NavItemDefinition[];
  currentPath: string;
  linkComponent?: LinkComponent;
  className?: string;
  /** Rendered above the nav list — typically the ProjectSwitcher. */
  header?: React.ReactNode;
  /** Whether the sidebar is in its collapsed (icon-only / hidden) mobile state. */
  isOpen?: boolean;
  onNavigate?: () => void;
}

export function isActive(item: NavItemDefinition, currentPath: string): boolean {
  const prefix = item.matchPrefix ?? item.href;
  return currentPath === item.href || currentPath.startsWith(`${prefix}/`);
}

export function Sidebar({
  items,
  currentPath,
  linkComponent: Link = DefaultLink,
  className,
  header,
  isOpen = true,
  onNavigate,
}: SidebarProps): React.ReactElement {
  return (
    <aside
      aria-label="Primary"
      data-open={isOpen}
      className={cn(
        "flex w-64 shrink-0 flex-col border-r border-forge-800 bg-forge-900",
        "fixed inset-y-0 left-0 z-40 -translate-x-full transition-transform lg:static lg:translate-x-0",
        isOpen && "translate-x-0",
        className,
      )}
    >
      {header ? <div className="border-b border-forge-800 p-4">{header}</div> : null}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = isActive(item, currentPath);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "block rounded px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-forge-800 text-steel-100"
                  : "text-steel-400 hover:bg-forge-850 hover:text-steel-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export const PROJECT_NAV_ITEMS = (projectId: string): NavItemDefinition[] => [
  { label: "Overview", href: `/app/projects/${projectId}` },
  { label: "Audits", href: `/app/projects/${projectId}/audits` },
  { label: "Issues", href: `/app/projects/${projectId}/issues` },
  { label: "Pages", href: `/app/projects/${projectId}/pages` },
  { label: "Performance", href: `/app/projects/${projectId}/performance` },
  { label: "Reports", href: `/app/projects/${projectId}/reports` },
];
