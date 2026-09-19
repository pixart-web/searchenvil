"use client";

import { useState } from "react";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";

export interface AppShellProps {
  sidebar: Omit<SidebarProps, "isOpen" | "onNavigate">;
  topbar: Omit<TopbarProps, "onToggleSidebar">;
  children: React.ReactNode;
}

/**
 * Responsive product shell: a fixed sidebar on desktop (lg+), an
 * off-canvas sidebar toggled from the topbar on mobile/tablet.
 */
export function AppShell({ sidebar, topbar, children }: AppShellProps): React.ReactElement {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-forge-950">
      <Sidebar {...sidebar} isOpen={isSidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-forge-950/70 lg:hidden"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar {...topbar} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
