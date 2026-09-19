import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/** Loading placeholder. Respects prefers-reduced-motion via the `motion-safe:` variant. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("rounded bg-forge-800 motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
