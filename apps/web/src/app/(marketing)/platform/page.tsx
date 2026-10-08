import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, CardContent } from "@searchanvil/ui";
import { LaunchListForm } from "@/components/marketing/LaunchListForm";
import { SupportingVisual } from "@/components/marketing/art/SupportingVisual";
import { SearchAuditIcon } from "@/components/marketing/icons";
import { SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "How SearchAnvil works: a direct website crawl, a six-category audit engine, a Search Health score, Forge Priorities issue ranking, and crawl comparison.",
  alternates: { canonical: `${SITE_ORIGIN}/platform` },
};

const CAPABILITIES = [
  {
    title: "Crawling",
    body: "SearchAnvil crawls your site directly — respecting robots.txt and your sitemap — so what it audits is your real, current pages, not a cached third-party index.",
  },
  {
    title: "Audit engine",
    body: "Crawled facts are checked against defined rules across six categories: Technical, Indexability, Content, Performance, Internal Linking, and Structured Data. The same site state always produces the same result.",
  },
  {
    title: "Search Health score",
    body: "A 0–100 score per category, weighted by severity, confidence, and how much of the site is affected — never a bare pass/fail tally. Every score keeps a full explanation attached for later review.",
  },
  {
    title: "Forge Priorities",
    body: "Issues are ranked, not just listed: severity, impact, effort, and affected-page count combine into a priority order, so the highest-value easy fix always surfaces first.",
  },
  {
    title: "Page-level analysis",
    body: "Every issue links to the exact pages it touches; every page shows every issue affecting it. Nothing is reported as a vague, site-wide warning.",
  },
  {
    title: "Performance sampling",
    body: "Optional real-browser performance sampling per page, layered on top of your crawl and audit when it's available — never required for the rest of SearchAnvil to work.",
  },
  {
    title: "Crawl comparison",
    body: "Compare any two crawls of the same site: Search Health before/after, fixed/new/persistent issues, and improved/worsened pages — derived from stored data, never a generated narrative.",
  },
  {
    title: "Reports",
    body: "Reports are computed live from the latest crawl and exportable as CSV — rule, category, severity, impact, effort, affected pages, and priority score per issue.",
  },
];

export default function PlatformPage(): React.ReactElement {
  return (
    <>
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <h1 className="font-display text-4xl font-semibold text-steel-100 sm:text-5xl">The platform</h1>
          <p className="mx-auto mt-4 max-w-xl text-steel-400 lg:mx-0">
            One loop, run continuously: project, website, crawl, facts, audit, Search Health, Forge
            Priorities, fixes, recrawl, comparison. Every capability below exists to serve that
            loop — nothing is bolted on for its own sake.
          </p>
        </div>
        <SupportingVisual Icon={SearchAuditIcon} label="The platform" />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((cap) => (
            <Card key={cap.title}>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-steel-100">{cap.title}</h2>
                <p className="mt-2 text-sm text-steel-400">{cap.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-forge-800 bg-forge-900/40">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-semibold text-steel-100">Deliberately not an all-in-one suite</h2>
          <p className="mt-4 text-steel-400">
            No global keyword database, backlink index, rank tracking, PPC/social/CRM tooling, or
            generative AI assistant. SearchAnvil answers five questions about your own website and
            stops there — see the full picture on{" "}
            <Link href="/pricing" className="text-ember-400 hover:underline">
              pricing
            </Link>
            .
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/launch-list">
              <Button size="lg">Join the launch list</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="text-left">
          <LaunchListForm source="platform" variant="compact" />
        </div>
      </section>
    </>
  );
}
