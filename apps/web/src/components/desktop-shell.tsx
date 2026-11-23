"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { PROJECT_NAV_ITEMS } from "@searchanvil/ui";

interface DesktopStatus {
  runtime: "ready";
  storage: "local";
  version: string;
}

declare global {
  interface Window {
    searchAnvilDesktop?: { status(): Promise<DesktopStatus> };
  }
}

export function useDesktopStatus(): DesktopStatus | undefined {
  const [status, setStatus] = useState<DesktopStatus>();
  useEffect(() => {
    let mounted = true;
    void window.searchAnvilDesktop
      ?.status()
      .then((value) => {
        if (mounted) setStatus(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  return status;
}

export function DesktopShell({
  projectName,
  target,
  items,
  pathname,
  children,
}: {
  projectName: string;
  target?: string;
  items: ReturnType<typeof PROJECT_NAV_ITEMS>;
  pathname: string;
  children: ReactNode;
}): React.ReactElement {
  const status = useDesktopStatus();
  return (
    <div className="command-shell">
      <header className="command-bar">
        <Link className="command-project" href="/app/projects" title="Switch project">
          {projectName}
        </Link>
        {target && (
          <span className="command-target" title={target}>
            {target}
          </span>
        )}
        <span className="command-settings">{status ? "Local workspace" : ""}</span>
      </header>
      <aside className="command-rail">
        <Link className="command-brand" href="/app/projects">
          <span aria-hidden="true" className="command-mark">
            SA
          </span>
          SearchAnvil
        </Link>
        <nav aria-label="Project" className="command-nav">
          {items.map((item, index) => {
            const active =
              pathname === item.href || (index > 0 && pathname.startsWith(item.href + "/"));
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="command-rail-footer">
          <Link href="/app/projects">All projects</Link>
          <Link href="/app/settings">Settings</Link>
        </div>
      </aside>
      <main className="command-workspace">{children}</main>
      <footer className="command-status">
        <span>{status ? "● Local runtime ready" : "○ Runtime status unavailable"}</span>
        <span>{status ? "Local storage" : ""}</span>
        <span>{status?.version}</span>
      </footer>
    </div>
  );
}
