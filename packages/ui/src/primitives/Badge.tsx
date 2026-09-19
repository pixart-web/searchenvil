import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type BadgeSeverity = "critical" | "high" | "medium" | "low" | "notice";
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "ember" | "violet";

const SEVERITY_TONE: Record<BadgeSeverity, BadgeTone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
  notice: "neutral",
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-forge-800 text-steel-300",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  ember: "bg-ember-500/15 text-ember-400",
  violet: "bg-violet-500/15 text-violet-500",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  severity?: BadgeSeverity;
}

/** Pass `severity` for a rule-driven color, or `tone` to pick one directly. */
export function Badge({ className, tone, severity, children, ...props }: BadgeProps): React.ReactElement {
  const resolvedTone = tone ?? (severity ? SEVERITY_TONE[severity] : "neutral");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        TONE_CLASSES[resolvedTone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
