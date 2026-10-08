import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";

/**
 * Shared chrome for every public marketing page (home, /platform,
 * /solutions/*, /pricing, /launch-list, /privacy, /terms). Deliberately
 * scoped to this route group via Next's `(marketing)` folder convention —
 * it does not wrap /login, /register, /onboarding, /app/* or /dev/*.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ember-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-forge-950"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
