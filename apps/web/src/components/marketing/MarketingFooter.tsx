import Link from "next/link";
import { CONTACT_EMAIL, FOOTER_LEGAL_NAV, FOOTER_PRODUCT_NAV, SITE_NAME } from "@/lib/site-config";
import { Lockup } from "@/components/marketing/Logo";

export function MarketingFooter(): React.ReactElement {
  return (
    <footer className="border-t border-forge-800">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
        <div>
          <Lockup />
          <p className="mt-3 max-w-xs text-sm text-steel-400">
            Reveal the hidden structure of your website — real crawl facts, ranked into what to
            fix first.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-steel-500">Product</h3>
          <ul className="flex flex-col gap-2">
            {FOOTER_PRODUCT_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-steel-400 hover:text-steel-100">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-steel-500">Legal & contact</h3>
          <ul className="flex flex-col gap-2">
            {FOOTER_LEGAL_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-steel-400 hover:text-steel-100">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-steel-400 hover:text-steel-100">
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-forge-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-steel-500">
          <span>© {new Date().getFullYear()} {SITE_NAME}. Prelaunch — no live billing.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-steel-300">
              Sign in
            </Link>
            <Link href="/launch-list" className="hover:text-steel-300">
              Join the launch list
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
