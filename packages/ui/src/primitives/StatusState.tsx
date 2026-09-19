import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type StatusStateKind = "empty" | "error" | "warning" | "cancelled" | "denied";

const KIND_CLASSES: Record<StatusStateKind, string> = {
  empty: "text-steel-400",
  error: "text-danger",
  warning: "text-warning",
  cancelled: "text-steel-400",
  denied: "text-danger",
};

export interface StatusStateProps {
  kind?: StatusStateKind;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Shared shape for every "nothing to show" screen: empty results, a failed
 * request, a cancelled crawl, or a permission-denied view. Every major
 * workflow should render one of these instead of a bare spinner or blank
 * panel — see docs/PRODUCT.md (error handling) and section 32 of the spec.
 */
export function StatusState({
  kind = "empty",
  title,
  description,
  action,
  icon,
  className,
}: StatusStateProps): React.ReactElement {
  return (
    <div
      role={kind === "error" || kind === "denied" ? "alert" : "status"}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-forge-800 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className={cn("h-8 w-8", KIND_CLASSES[kind])}>{icon}</div> : null}
      <p className="text-sm font-semibold text-steel-100">{title}</p>
      {description ? <p className="max-w-sm text-sm text-steel-400">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
