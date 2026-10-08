import { AnvilMark } from "@/components/marketing/Logo";

interface SupportingVisualProps {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}

/**
 * A real above-the-fold visual for supporting pages (Platform, the
 * Solutions pages, Pricing) — the same layered-panel + anvil-mark language
 * as the homepage hero/closing artwork, distinguished per page by a small
 * role/feature icon, so these pages share the new identity instead of
 * falling back to the old plain-text-card template.
 */
export function SupportingVisual({ Icon, label, className }: SupportingVisualProps): React.ReactElement {
  return (
    <div aria-hidden="true" className={`relative mx-auto h-56 w-full max-w-sm sm:h-64 ${className ?? ""}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute h-36 w-56 -translate-x-8 -translate-y-4 rounded-xl border border-forge-800 bg-forge-900 opacity-40" />
        <div className="absolute h-36 w-56 translate-x-6 translate-y-3 rounded-xl border border-forge-800 bg-forge-900 opacity-70" />
        <div className="relative flex h-36 w-56 flex-col items-center justify-center gap-3 rounded-xl border border-ember-500/50 bg-forge-900 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)]">
          <Icon className="h-8 w-8 text-ember-400" />
          <AnvilMark size={22} tone="dark" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-600">{label}</span>
        </div>
      </div>
    </div>
  );
}
