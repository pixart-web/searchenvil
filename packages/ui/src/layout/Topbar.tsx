import { cn } from "../lib/cn";

export interface TopbarProps {
  /** Rendered left of the actions — typically the project/org switcher. */
  left?: React.ReactNode;
  /** Rendered right-aligned — typically a user menu. */
  right?: React.ReactNode;
  onToggleSidebar?: () => void;
  className?: string;
}

export function Topbar({ left, right, onToggleSidebar, className }: TopbarProps): React.ReactElement {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-4 border-b border-forge-800 bg-forge-900 px-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            className="rounded p-2 text-steel-300 hover:bg-forge-850 hover:text-steel-100 lg:hidden"
          >
            <span aria-hidden="true" className="block h-4 w-5">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="mt-1.5 block h-0.5 w-5 bg-current" />
              <span className="mt-1.5 block h-0.5 w-5 bg-current" />
            </span>
          </button>
        ) : null}
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">
          SearchEnvil
        </span>
        {left}
      </div>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}

export interface ProjectSwitcherProps {
  currentProjectName: string;
  onOpen?: () => void;
}

/** `onOpen` navigates to the projects list (apps/web wires it to /app/projects) — a simple navigation target rather than an in-place dropdown menu, since the number of projects a user has is expected to stay small. */
export function ProjectSwitcher({ currentProjectName, onOpen }: ProjectSwitcherProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 rounded px-2 py-1 text-sm text-steel-300 hover:bg-forge-850 hover:text-steel-100"
    >
      <span className="max-w-[12rem] truncate font-medium">{currentProjectName}</span>
      <span aria-hidden="true" className="text-steel-500">
        ⌄
      </span>
    </button>
  );
}
