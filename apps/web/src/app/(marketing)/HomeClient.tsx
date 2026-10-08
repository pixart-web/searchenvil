"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button, Card, CardContent } from "@searchanvil/ui";
import { LaunchListForm } from "@/components/marketing/LaunchListForm";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { HeroComposition } from "@/components/marketing/art/HeroComposition";
import { WebsiteAnatomy } from "@/components/marketing/art/WebsiteAnatomy";
import { ProductStage } from "@/components/marketing/art/ProductStage";
import { PriorityDetail } from "@/components/marketing/art/PriorityDetail";
import { ComparisonReveal } from "@/components/marketing/art/ComparisonReveal";
import { ClosingArt } from "@/components/marketing/art/ClosingArt";
import { SearchAuditIcon, OrganizationsIcon, TrendIcon } from "@/components/marketing/icons";
import { FAQ_ITEMS, PRICING, SOLUTIONS_NAV } from "@/lib/site-config";
import {
  FaqJsonLd,
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  WebSiteJsonLd,
} from "@/components/marketing/StructuredData";

const AUDIENCES = [
  {
    title: "SEO Professionals",
    body: "Run a defensible technical audit in minutes, not a spreadsheet. Every finding cites its evidence.",
    href: "/solutions/seo-professionals",
    Icon: SearchAuditIcon,
  },
  {
    title: "Agencies",
    body: "Manage multiple client organizations and projects from one place, each with its own crawl history.",
    href: "/solutions/agencies",
    Icon: OrganizationsIcon,
  },
  {
    title: "In-House Teams",
    body: "Track Search Health over time and prove the technical backlog is actually shrinking.",
    href: "/solutions/in-house-teams",
    Icon: TrendIcon,
  },
];

/**
 * The homepage's six-scene body. Kept as a client component (scroll
 * choreography needs refs/effects) and rendered from the server
 * `page.tsx`, which is where `metadata`/OG/canonical actually live — a
 * "use client" file can't export `metadata`, so splitting it this way is
 * what keeps the animated homepage and its SEO tags both working.
 */
export function HomeClient(): React.ReactElement {
  const heroCopyRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <SoftwareApplicationJsonLd />
      <FaqJsonLd items={FAQ_ITEMS} />

      {/* Scene 1 — Hero */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <div ref={heroCopyRef} className="relative z-10 mx-auto max-w-6xl px-6 pt-20 sm:pt-28">
          <div className="max-w-xl lg:max-w-[40%]">
            <h1 id="hero-heading" className="font-display text-4xl font-medium leading-[1.08] text-steel-100 sm:text-5xl">
              Reveal the hidden structure of your website.
            </h1>
            <p className="mt-5 text-lg text-steel-400">
              SearchAnvil crawls every page, separates fact from opinion, and tells you exactly
              what to fix first — so nothing important stays buried under the surface.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/platform">
                <Button size="lg">
                  Explore the platform <span aria-hidden="true">→</span>
                </Button>
              </Link>
              <Link href="/launch-list">
                <Button size="lg" variant="secondary">
                  Join the launch list
                </Button>
              </Link>
            </div>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.2em] text-steel-600">
              {PRICING.framing}: {PRICING.displayFull}
            </p>
          </div>
        </div>

        <HeroComposition copyRef={heroCopyRef} />
      </section>

      {/* Scene 2 — Website Anatomy */}
      <section aria-labelledby="anatomy-heading" className="border-t border-forge-800 bg-forge-900/40 py-20 sm:py-28">
        <div className="mx-auto mb-12 max-w-2xl px-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Website anatomy</p>
          <h2 id="anatomy-heading" className="mt-3 font-display text-3xl font-semibold text-steel-100 sm:text-4xl">
            Every page, mapped and connected
          </h2>
          <p className="mt-3 text-steel-400">
            A website can look finished on the surface while its structure quietly works against
            it. SearchAnvil maps every page, how they link together, and exactly where that
            structure breaks down.
          </p>
        </div>
        <WebsiteAnatomy />
      </section>

      {/* Scene 3 — Product walkthrough */}
      <section aria-labelledby="walkthrough-heading" className="py-20 sm:py-28">
        <div className="mx-auto mb-4 max-w-2xl px-6 text-center">
          <h2 id="walkthrough-heading" className="font-display text-3xl font-semibold text-steel-100 sm:text-4xl">
            From crawl to fix, in one loop
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-steel-400">
            Crawl, audit, score, prioritize, fix, recrawl, compare — see how each step of
            SearchAnvil actually looks.
          </p>
        </div>
        <ProductStage />
      </section>

      {/* Scene 4 — Priorities (paper break) */}
      <PriorityDetail />

      {/* Scene 5 — Progress / reporting */}
      <section aria-labelledby="progress-heading" className="border-t border-forge-800 py-20 sm:py-28">
        <div className="mx-auto mb-10 max-w-2xl px-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Progress</p>
          <h2 id="progress-heading" className="mt-3 font-display text-3xl font-semibold text-steel-100 sm:text-4xl">
            Did the website actually improve?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-steel-400">
            Compare any two crawls of the same site: Search Health before and after, which issues
            got fixed, which are new, and which pages changed — drag the slider or scroll to see
            it unfold.
          </p>
        </div>
        <ComparisonReveal />
      </section>

      {/* Audience */}
      <section aria-labelledby="audience-heading" className="border-t border-forge-800 bg-forge-900/40 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 id="audience-heading" className="mb-10 text-center font-display text-3xl font-semibold text-steel-100 sm:text-4xl">
            Built for people who own the fix
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <Card key={audience.href} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-6">
                  <audience.Icon className="h-8 w-8 text-ember-400" />
                  <h3 className="text-lg font-semibold text-steel-100">{audience.title}</h3>
                  <p className="flex-1 text-sm text-steel-400">{audience.body}</p>
                  <Link href={audience.href} className="text-sm font-medium text-ember-400 hover:underline">
                    Read more →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="sr-only">Also see: {SOLUTIONS_NAV.map((n) => n.label).join(", ")}</p>
        </div>
      </section>

      {/* Scene 6 — Pricing / closing */}
      <section id="pricing" aria-labelledby="pricing-heading" className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <h2 id="pricing-heading" className="font-display text-3xl font-medium text-steel-100 sm:text-4xl">
                Make your next website decision clearer.
              </h2>
              <p className="mt-4 max-w-md text-steel-400 lg:mx-0">
                Full access to crawling, audits, Search Health, Forge Priorities, and reports — one
                organization, its projects and websites, no tiers to compare.
              </p>

              <div className="mt-8">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-steel-500">{PRICING.framing}</p>
                <p className="mt-2 text-5xl font-semibold text-steel-100">
                  {PRICING.displayPrice}
                  <span className="text-lg font-normal text-steel-400"> / {PRICING.interval}</span>
                </p>
                <p className="mt-3 max-w-sm text-sm text-steel-400 lg:mx-0">
                  Pricing is not final and nothing is billed today. Join the launch list to be
                  notified when general availability opens.
                </p>
                <Link href="/launch-list" className="mt-6 inline-block">
                  <Button size="lg">
                    Join the launch list <span aria-hidden="true">→</span>
                  </Button>
                </Link>
              </div>
            </div>
            <ClosingArt />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="border-t border-forge-800 bg-forge-900/40 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 id="faq-heading" className="mb-8 text-center font-display text-3xl font-semibold text-steel-100 sm:text-4xl">
            Frequently asked questions
          </h2>
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* Closing CTA */}
      <section aria-labelledby="closing-heading" className="mx-auto max-w-2xl px-6 py-20 text-center sm:py-28">
        <h2 id="closing-heading" className="font-display text-3xl font-semibold text-steel-100 sm:text-4xl">
          One purpose-built audit, done properly
        </h2>
        <p className="mt-4 text-steel-400">
          SearchAnvil focuses entirely on technical SEO — real crawl facts, ranked into what to fix
          first — instead of trying to be a keyword tool, a backlink index, or a generative
          assistant on top.
        </p>
        <div className="mt-8 mx-auto max-w-md text-left">
          <LaunchListForm source="homepage-closing" variant="compact" />
        </div>
      </section>
    </>
  );
}
