"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@searchanvil/ui";
import { SOLUTIONS_NAV } from "@/lib/site-config";
import { Lockup } from "@/components/marketing/Logo";

export function MarketingNav(): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-forge-800 bg-forge-950/95 backdrop-blur supports-[backdrop-filter]:bg-forge-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="SearchAnvil home">
          <Lockup />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          <Link
            href="/platform"
            className="rounded px-3 py-2 text-sm font-medium text-steel-300 transition-colors hover:text-steel-100"
          >
            Platform
          </Link>

          <div
            className="relative"
            onMouseEnter={() => setSolutionsOpen(true)}
            onMouseLeave={() => setSolutionsOpen(false)}
          >
            <button
              type="button"
              aria-expanded={solutionsOpen}
              aria-haspopup="true"
              onClick={() => setSolutionsOpen((v) => !v)}
              className="rounded px-3 py-2 text-sm font-medium text-steel-300 transition-colors hover:text-steel-100"
            >
              Solutions
            </button>
            {solutionsOpen ? (
              <div className="absolute left-0 top-full w-64 rounded border border-forge-800 bg-forge-900 p-2 shadow-lg">
                {SOLUTIONS_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded px-3 py-2 text-sm text-steel-300 hover:bg-forge-850 hover:text-steel-100"
                    onClick={() => setSolutionsOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <Link
            href="/pricing"
            className="rounded px-3 py-2 text-sm font-medium text-steel-300 transition-colors hover:text-steel-100"
          >
            Pricing
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="rounded px-3 py-2 text-sm font-medium text-steel-300 hover:text-steel-100">
            Sign in
          </Link>
          <Link href="/launch-list">
            <Button size="sm">Join the launch list <span aria-hidden="true">→</span></Button>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded border border-forge-800 text-steel-100 lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span aria-hidden="true" className="relative block h-3.5 w-4">
            <span
              className={`absolute left-0 top-0 h-0.5 w-4 bg-current transition-transform ${mobileOpen ? "translate-y-[6px] rotate-45" : ""}`}
            />
            <span className={`absolute left-0 top-1.5 h-0.5 w-4 bg-current transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
            <span
              className={`absolute left-0 top-3 h-0.5 w-4 bg-current transition-transform ${mobileOpen ? "-translate-y-[6px] -rotate-45" : ""}`}
            />
          </span>
        </button>
      </div>

      {mobileOpen ? (
        <nav id="mobile-nav" aria-label="Primary mobile" className="border-t border-forge-800 px-6 py-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            <li>
              <Link
                href="/platform"
                className="block rounded px-3 py-2 text-sm font-medium text-steel-300 hover:bg-forge-850 hover:text-steel-100"
                onClick={() => setMobileOpen(false)}
              >
                Platform
              </Link>
            </li>
            {SOLUTIONS_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded px-3 py-2 pl-6 text-sm text-steel-400 hover:bg-forge-850 hover:text-steel-100"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/pricing"
                className="block rounded px-3 py-2 text-sm font-medium text-steel-300 hover:bg-forge-850 hover:text-steel-100"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </Link>
            </li>
            <li className="mt-2 border-t border-forge-800 pt-2">
              <Link
                href="/login"
                className="block rounded px-3 py-2 text-sm font-medium text-steel-300 hover:bg-forge-850 hover:text-steel-100"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/launch-list" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="mt-2 w-full">
                  Join the launch list
                </Button>
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
