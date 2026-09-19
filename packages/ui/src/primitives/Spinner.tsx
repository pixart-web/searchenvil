import { cn } from "../lib/cn";

export function Spinner({ className }: { className?: string }): React.ReactElement {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-steel-500 border-t-ember-500",
        className,
      )}
    />
  );
}
