import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded border border-forge-800 bg-forge-900 px-3 text-sm text-steel-100",
          "placeholder:text-steel-500",
          "focus:border-ember-500 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>): React.ReactElement {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-steel-300", className)} {...props} />
  );
}

export function FieldError({ children }: { children?: string }): React.ReactElement | null {
  if (!children) {
    return null;
  }
  return (
    <p role="alert" className="mt-1.5 text-sm text-danger">
      {children}
    </p>
  );
}
