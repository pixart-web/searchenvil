"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Badge, Card, CardContent, SearchHealthGauge } from "@searchanvil/ui";
import { ensureGsap, ScrollTrigger } from "@/lib/gsap";
import { usePrefersReducedMotion, useIsMobile } from "@/lib/motion";

interface Chapter {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
}

const CHAPTERS: Chapter[] = [
  {
    id: "overview",
    eyebrow: "01 — Overview",
    title: "Crawl the real website, not an estimate",
    body: "SearchAnvil crawls every reachable page of your site, following its own robots.txt and sitemap, and reads back the facts — status codes, headers, links, markup — so you're looking at what your website actually does.",
  },
  {
    id: "issues",
    eyebrow: "02 — Issues",
    title: "Every finding, graded and ranked",
    body: "Findings span six categories — Technical, Indexability, Content, Performance, Internal Linking, Structured Data — and every one is a Forge Priority: ranked by severity, impact, and effort, so the highest-value easy fix always surfaces first.",
  },
  {
    id: "pages",
    eyebrow: "03 — Affected pages",
    title: "Every issue, traced to its pages",
    body: "Select any issue and see exactly which pages it touches. Nothing is reported as a vague, site-wide warning — every page also shows every issue affecting it.",
  },
  {
    id: "reports",
    eyebrow: "04 — Reports",
    title: "A live report, exportable in one click",
    body: "Reports compute from your latest crawl and export straight to CSV — rule, category, severity, impact, effort, affected pages, and priority score for every issue.",
  },
];

const SAMPLE_ISSUES = [
  { title: "Missing meta descriptions", severity: "medium" as const, pages: 14, effort: "Easy" },
  { title: "Broken internal links", severity: "high" as const, pages: 9, effort: "Easy" },
  { title: "Duplicate H1 across templates", severity: "low" as const, pages: 31, effort: "Medium" },
];

const AFFECTED_PAGES = [
  { path: "/products/anvil-pro", status: "404" },
  { path: "/blog/2024-roundup", status: "404" },
  { path: "/docs/getting-started", status: "404" },
];

function ChapterPanel({ chapterId }: { chapterId: string }): React.ReactElement {
  if (chapterId === "issues") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-600">Forge Priorities</p>
          {SAMPLE_ISSUES.map((issue) => (
            <div
              key={issue.title}
              className="flex items-center justify-between gap-3 rounded border border-forge-800 bg-forge-850 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-steel-100">{issue.title}</p>
                <p className="mt-0.5 font-mono text-xs text-steel-500">{issue.pages} pages affected · {issue.effort}</p>
              </div>
              <Badge severity={issue.severity}>{issue.severity}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (chapterId === "pages") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-steel-100">Broken internal links</p>
            <Badge tone="danger">9 pages</Badge>
          </div>
          {AFFECTED_PAGES.map((page) => (
            <div key={page.path} className="flex items-center justify-between rounded border border-forge-800 bg-forge-850 px-3 py-1.5">
              <span className="truncate font-mono text-xs text-steel-300">{page.path}</span>
              <Badge tone="danger">{page.status}</Badge>
            </div>
          ))}
          <p className="px-1 pt-0.5 font-mono text-[11px] text-steel-600">+ 6 more</p>
        </CardContent>
      </Card>
    );
  }

  if (chapterId === "reports") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-4">
            <SearchHealthGauge score={78} size={72} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-600">Report — Sep 2026</p>
              <p className="mt-1 text-sm font-medium text-steel-100">62 issues across 6 categories</p>
            </div>
          </div>
          <button
            type="button"
            className="self-start rounded border border-forge-800 bg-forge-850 px-3 py-1.5 font-mono text-xs text-steel-300"
            tabIndex={-1}
            aria-hidden="true"
          >
            Export CSV
          </button>
        </CardContent>
      </Card>
    );
  }

  return <FlatOverviewDashboard />;
}

const SIDEBAR_ITEMS = ["Overview", "Issues", "Pages", "Compare"] as const;
const ISSUES_OVER_TIME = {
  weeks: ["Mar 26", "Apr 2", "Apr 9", "Apr 16", "Apr 24"],
  critical: [58, 50, 44, 30, 24],
  high: [90, 82, 70, 58, 48],
  medium: [120, 110, 95, 70, 52],
};
const TOP_ISSUE_TYPES = [
  { type: "Missing meta descriptions", pages: 2341, trend: "+12%", up: true },
  { type: "Duplicate title tags", pages: 1021, trend: "+4%", up: true },
  { type: "Slow page speed", pages: 892, trend: "-18%", up: false },
  { type: "Missing canonical tags", pages: 421, trend: "+7%", up: true },
  { type: "Redirect chains", pages: 318, trend: "-23%", up: false },
];

/**
 * Scene 2's large flat dashboard: a browser-chrome-framed recreation of the
 * real /app/projects/[projectId] overview, built from the same primitives
 * and field names as that real page (Card, Badge, SearchHealthGauge —
 * overallScore / issue counts / issuesByCategory in
 * apps/api's project-overview DTO) but filled with illustrative numbers,
 * because the demo seed (packages/database/prisma/seed.ts) creates a user,
 * org and project with no crawl or issues, so there's no real data to
 * screenshot — see docs/MARKETING_SITE.md. The "Issues over time" trend
 * chart and "Top issue types" table shown in the approved reference don't
 * have an equivalent real endpoint yet either, so this whole panel is
 * labeled "Illustrative data" rather than presented as a captured screen.
 */
function FlatOverviewDashboard(): React.ReactElement {
  const chartWidth = 460;
  const chartHeight = 140;
  const maxStack = 300;

  function toPoints(series: number[]): string {
    const step = chartWidth / (series.length - 1);
    return series
      .map((v, i) => `${(i * step).toFixed(1)},${(chartHeight - (v / maxStack) * chartHeight).toFixed(1)}`)
      .join(" ");
  }

  return (
    <div className="overflow-hidden rounded-xl border border-forge-800 bg-forge-900 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2 border-b border-forge-800 bg-forge-850 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-forge-800" />
        <span className="h-2.5 w-2.5 rounded-full bg-forge-800" />
        <span className="h-2.5 w-2.5 rounded-full bg-forge-800" />
        <span className="ml-3 flex-1 truncate rounded bg-forge-950 px-3 py-1 font-mono text-[11px] text-steel-500">
          app.searchanvil.com/projects/demo/overview
        </span>
      </div>

      <div className="flex">
        <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-forge-800 bg-forge-950/60 p-3 sm:flex">
          {SIDEBAR_ITEMS.map((item, i) => (
            <div
              key={item}
              className={`rounded px-2.5 py-1.5 font-mono text-[11px] ${
                i === 0 ? "bg-ember-500/15 text-ember-400" : "text-steel-500"
              }`}
            >
              {item}
            </div>
          ))}
        </div>

        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-forge-800 bg-forge-850 p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Health score</p>
              <div className="mt-1.5 flex items-center gap-2">
                <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90 shrink-0">
                  <circle cx="16" cy="16" r="13" fill="none" stroke="#1D232C" strokeWidth="4" />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    stroke="#36B978"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 13}
                    strokeDashoffset={2 * Math.PI * 13 * (1 - 0.78)}
                  />
                </svg>
                <p className="text-xl font-semibold leading-none text-steel-100">
                  78 <span className="text-[10px] font-normal text-success">+6</span>
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-forge-800 bg-forge-850 p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Issues</p>
              <p className="mt-1.5 text-xl font-semibold text-steel-100">
                142 <span className="text-[10px] font-normal text-danger">-28</span>
              </p>
            </div>
            <div className="rounded-lg border border-forge-800 bg-forge-850 p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Indexed pages</p>
              <p className="mt-1.5 text-xl font-semibold text-steel-100">
                8,421 <span className="text-[10px] font-normal text-success">+2%</span>
              </p>
            </div>
            <div className="rounded-lg border border-forge-800 bg-forge-850 p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Avg page speed</p>
              <p className="mt-1.5 text-xl font-semibold text-steel-100">
                1.9s <span className="text-[10px] font-normal text-success">-0.4s</span>
              </p>
            </div>
          </div>

          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-forge-800 bg-forge-850 p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-steel-500">Issues over time</p>
                <span className="rounded border border-forge-700 px-2 py-0.5 font-mono text-[9px] text-steel-500">All issues</span>
              </div>
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mt-2 h-28 w-full" preserveAspectRatio="none">
                <polyline points={toPoints(ISSUES_OVER_TIME.medium)} fill="none" stroke="#E3A72F" strokeWidth="1.5" opacity={0.85} />
                <polyline points={toPoints(ISSUES_OVER_TIME.high)} fill="none" stroke="#F3AD75" strokeWidth="1.5" opacity={0.85} />
                <polyline points={toPoints(ISSUES_OVER_TIME.critical)} fill="none" stroke="#E65353" strokeWidth="1.5" />
              </svg>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-steel-600">
                {ISSUES_OVER_TIME.weeks.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-forge-800 bg-forge-850 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-steel-500">Top issue types</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {TOP_ISSUE_TYPES.map((issue) => (
                  <div key={issue.type} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-steel-300">{issue.type}</span>
                    <span className={`shrink-0 font-mono ${issue.up ? "text-danger" : "text-success"}`}>
                      {issue.up ? "↑" : "↓"} {issue.trend}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="border-t border-forge-800 bg-forge-950 px-4 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-steel-600">
        Illustrative data
      </p>
    </div>
  );
}

/**
 * Scene 3: a large sticky desktop "product stage" with four chapters
 * (Overview / Issues / Affected pages / Reports). Two ways to move through
 * it, both real: scrolling scrubs a pinned timeline that crossfades the
 * panel, and the eyebrow buttons above the stage are real, keyboard-
 * reachable <button>s that scroll to a chapter directly — useful for anyone
 * not scrolling linearly, and the accessible path when JS motion is off.
 */
export function ProductStage(): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  // On mobile the pin is skipped entirely (a 300%-of-viewport pinned range
  // would be a very long, disorienting scroll on a small screen). Mobile
  // renders the same static stacked-chapter layout used for reduced
  // motion — a short, always-visible sequence instead of a long pin.
  useLayoutEffect(() => {
    if (reducedMotion || isMobile || !sectionRef.current) return;
    const gsap = ensureGsap();

    const ctx = gsap.context(() => {
      const panels = panelRefs.current.filter(Boolean) as HTMLDivElement[];
      gsap.set(panels.slice(1), { autoAlpha: 0 });

      const st = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=300%",
        scrub: 0.4,
        pin: true,
        pinSpacing: true,
        onUpdate: (self) => {
          const idx = Math.min(CHAPTERS.length - 1, Math.floor(self.progress * CHAPTERS.length));
          setActiveIndex((prev) => {
            if (prev === idx) return prev;
            gsap.to(panels[prev] ?? null, { autoAlpha: 0, duration: 0.25 });
            gsap.to(panels[idx] ?? null, { autoAlpha: 1, duration: 0.25 });
            return idx;
          });
        },
      });

      return () => st.kill();
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion, isMobile]);

  function goToChapter(index: number): void {
    setActiveIndex(index);
    if (reducedMotion || isMobile) return;
    const trigger = ScrollTrigger.getAll().find((t) => t.trigger === sectionRef.current);
    if (trigger) {
      const target = trigger.start + (trigger.end - trigger.start) * ((index + 0.5) / CHAPTERS.length);
      window.scrollTo({ top: target, behavior: "smooth" });
    }
  }

  if (reducedMotion || isMobile) {
    return (
      <div className="flex flex-col gap-16">
        {CHAPTERS.map((chapter) => (
          <div key={chapter.id} className="grid gap-6 sm:grid-cols-2 sm:items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">{chapter.eyebrow}</p>
              <h3 className="mt-2 text-2xl font-semibold text-steel-100">{chapter.title}</h3>
              <p className="mt-3 text-steel-400">{chapter.body}</p>
            </div>
            <ChapterPanel chapterId={chapter.id} />
          </div>
        ))}
      </div>
    );
  }

  const active = CHAPTERS[activeIndex] ?? CHAPTERS[0]!;

  return (
    <div ref={sectionRef} className="relative">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center gap-8 px-6 py-16">
        <div role="tablist" aria-label="Product walkthrough chapters" className="flex flex-wrap gap-2">
          {CHAPTERS.map((chapter, index) => (
            <button
              key={chapter.id}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              onClick={() => goToChapter(index)}
              className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
                activeIndex === index
                  ? "border-ember-500 bg-ember-500/10 text-ember-400"
                  : "border-forge-800 text-steel-500 hover:text-steel-200"
              }`}
            >
              {chapter.eyebrow}
            </button>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h3 className="text-2xl font-semibold text-steel-100 sm:text-3xl">{active.title}</h3>
            <p className="mt-4 max-w-md text-steel-400">{active.body}</p>
            <div aria-live="polite" className="sr-only">
              {active.title}
            </div>
          </div>

          <div className="relative min-h-[280px]">
            {CHAPTERS.map((chapter, index) => (
              <div
                key={chapter.id}
                ref={(el) => {
                  panelRefs.current[index] = el;
                }}
                className="absolute inset-0"
                aria-hidden={activeIndex !== index}
              >
                <ChapterPanel chapterId={chapter.id} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
