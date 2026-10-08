import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button } from "@searchanvil/ui";
import { LaunchListForm } from "@/components/marketing/LaunchListForm";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { ClosingArt } from "@/components/marketing/art/ClosingArt";
import { FAQ_ITEMS, PRICING, SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "SearchAnvil's expected launch price is €79.99/month for a single organization plan. SearchAnvil is prelaunch — no billing is live yet. Join the launch list to be notified at general availability.",
  alternates: { canonical: `${SITE_ORIGIN}/pricing` },
};

const INCLUDED = [
  "Unlimited crawls of your added websites, subject to fair use",
  "Full audit engine: Technical, Indexability, Content, Performance, Internal Linking, Structured Data",
  "Search Health score that stays fully explained, category by category",
  "Forge Priorities issue ranking (severity, impact, effort, affected pages)",
  "Crawl comparison between any two crawls of the same site",
  "Reports with CSV export",
  "Multiple projects and websites within your organization",
];

const PRICING_FAQ = FAQ_ITEMS.filter((f) =>
  ["Is SearchAnvil available today?", "What will the price be?"].includes(f.question),
);

export default function PricingPage(): React.ReactElement {
  return (
    <>
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 sm:py-28 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <Badge tone="ember">Prelaunch</Badge>
          <h1 className="mt-4 font-display text-4xl font-semibold text-steel-100 sm:text-5xl">Pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-steel-400 lg:mx-0">
            One plan. No tiers to compare, no usage caps designed to upsell you. SearchAnvil has
            not launched yet, so nothing below is billed today — this is the price we expect to
            charge at general availability.
          </p>
        </div>
        <ClosingArt />
      </section>

      <section className="mx-auto max-w-md px-6 pb-20">
        <div className="rounded-lg border border-forge-800 bg-forge-900 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-steel-500">{PRICING.framing}</p>
          <p className="mt-2 text-5xl font-semibold text-steel-100">
            {PRICING.displayPrice}
            <span className="text-lg font-normal text-steel-400">/{PRICING.interval}</span>
          </p>
          <p className="mt-2 text-xs text-steel-500">
            Subject to change before general availability. No trial, refund, or contract terms are
            in effect because no purchase is currently possible.
          </p>
          <ul className="mt-6 flex flex-col gap-2.5 text-left text-sm text-steel-300">
            {INCLUDED.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="mt-0.5 text-ember-400">
                  →
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link href="/launch-list" className="mt-8 block">
            <Button className="w-full">Join the launch list</Button>
          </Link>
        </div>
      </section>

      <section className="border-t border-forge-800 bg-forge-900/40">
        <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
          <h2 className="mb-6 text-center text-2xl font-semibold text-steel-100">Pricing FAQ</h2>
          <FaqAccordion items={PRICING_FAQ} />
        </div>
      </section>

      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-steel-100">Not ready to commit? Just watch for launch.</h2>
        <div className="mt-6 text-left">
          <LaunchListForm source="pricing" variant="compact" />
        </div>
      </section>
    </>
  );
}
