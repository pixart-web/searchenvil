"use client";

import { useLayoutEffect, useRef } from "react";
import { ensureGsap } from "@/lib/gsap";
import { usePrefersReducedMotion, useIsMobile } from "@/lib/motion";

const ISSUE_LIST = [
  { title: "Broken internal links", severity: "High impact · Easy", focus: true },
  { title: "Missing meta descriptions", severity: "Medium impact · Easy" },
  { title: "Duplicate H1 across templates", severity: "Low impact · Medium" },
  { title: "Oversized hero images", severity: "Medium impact · Medium" },
];

const AFFECTED_PAGES = [
  { path: "/products/anvil-pro", type: "Feature page" },
  { path: "/blog/2024-roundup", type: "Blog post" },
  { path: "/docs/getting-started", type: "Resource page" },
];

const IMPACT_TREND = [3, 5, 4, 7, 6, 9, 8, 9];
const DETAIL_TABS = ["Affected pages", "Why it matters", "How to fix"] as const;

/**
 * Scene 4 (the warm-ivory "paper" break): Forge Priorities' selection →
 * expansion → affected-pages behavior made visible as one continuous
 * composition — a ranked list resolves into one focused issue-detail card,
 * which then reveals the pages it touches.
 */
export function PriorityDetail(): React.ReactElement {
  const sectionRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    if (reducedMotion || !sectionRef.current) return;
    const gsap = ensureGsap();

    const ctx = gsap.context(() => {
      gsap.set(detailRef.current, { autoAlpha: 0, y: 24 });
      gsap.set(pagesRef.current, { autoAlpha: 0, y: 16 });
      gsap.set(".priority-row-rest", { autoAlpha: 1 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: isMobile ? "top 70%" : "top top",
          end: isMobile ? "bottom 50%" : "+=120%",
          scrub: 0.5,
          pin: !isMobile,
          pinSpacing: !isMobile,
        },
      });

      tl.to(".priority-row-focus", { scale: 1.03, duration: 0.5, ease: "none" }, 0)
        .to(".priority-row-rest", { autoAlpha: 0.35, y: 6, duration: 0.5, ease: "none" }, 0.1)
        .to(detailRef.current, { autoAlpha: 1, y: 0, duration: 0.6, ease: "none" }, 0.35)
        .to(pagesRef.current, { autoAlpha: 1, y: 0, duration: 0.6, ease: "none" }, 0.75);
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion, isMobile]);

  return (
    <div ref={sectionRef} className="relative bg-paper py-24 text-ink sm:py-28">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-700">Forge Priorities</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
            Know what deserves attention first
          </h2>
          <p className="mt-4 max-w-md text-ink-muted">
            Every issue is scored by severity, impact, effort, and how many pages it actually
            touches — a high-impact, easy fix always surfaces before a low-value, hard one. Open
            any priority and its affected pages are right there, not a separate hunt.
          </p>

          <div className="mt-8 flex flex-col gap-2">
            {ISSUE_LIST.map((issue) => (
              <div
                key={issue.title}
                className={`rounded-lg border px-4 py-3 ${
                  issue.focus
                    ? "priority-row-focus border-ember-500 bg-white"
                    : "priority-row-rest border-paper-line bg-white/60"
                }`}
              >
                <p className="text-sm font-medium text-ink">{issue.title}</p>
                <p className="mt-0.5 font-mono text-xs text-ink-muted">{issue.severity}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div ref={detailRef} className="rounded-xl border border-paper-line bg-white p-6 shadow-[0_30px_60px_-30px_rgba(23,27,32,0.25)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Issue detail</span>
              <span className="rounded bg-danger/10 px-2 py-0.5 font-mono text-[11px] font-medium text-danger">Critical</span>
            </div>
            <p className="mt-3 text-base font-semibold text-ink">Broken internal links</p>
            <p className="mt-1 text-sm text-ink-muted">
              9 internal links resolve to a 404. Each one wastes crawl budget and internal link
              equity that should reach the page it was meant for.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg border border-paper-line bg-paper px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">Affected pages</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  9 <span className="font-mono text-[10px] font-normal text-danger">+12%</span>
                </p>
              </div>
              <div className="rounded-lg border border-paper-line bg-paper px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">Potential impact</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">High</p>
                <svg viewBox="0 0 48 14" className="mt-1 h-3 w-12" preserveAspectRatio="none" aria-hidden="true">
                  {IMPACT_TREND.map((v, i) => (
                    <rect key={i} x={i * 6} y={14 - v * 1.4} width="4" height={v * 1.4} fill="#9A4712" opacity={0.7} />
                  ))}
                </svg>
              </div>
              <div className="rounded-lg border border-paper-line bg-paper px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">Category</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">Internal linking</p>
              </div>
              <div className="rounded-lg border border-paper-line bg-paper px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">First / last seen</p>
                <p className="mt-0.5 text-[11px] font-medium text-ink">Mar 3 → Apr 24</p>
              </div>
            </div>

            <div className="mt-5 flex gap-4 border-b border-paper-line font-mono text-[11px] uppercase tracking-[0.1em]">
              {DETAIL_TABS.map((tab, i) => (
                <span
                  key={tab}
                  className={`-mb-px border-b-2 pb-2 ${i === 0 ? "border-ember-500 text-ember-700" : "border-transparent text-ink-muted"}`}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>

          <div ref={pagesRef} className="rounded-xl border border-paper-line bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Affected pages</p>
              <span className="font-mono text-[10px] text-ink-muted">Status · Page type</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {AFFECTED_PAGES.map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-3 rounded border border-paper-line bg-paper px-3 py-1.5">
                  <span className="truncate font-mono text-xs text-ink">{page.path}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-danger/10 px-2 py-0.5 font-mono text-[11px] font-medium text-danger">Missing</span>
                    <span className="hidden font-mono text-[10px] text-ink-muted sm:inline">{page.type}</span>
                  </span>
                </div>
              ))}
              <p className="px-1 pt-0.5 font-mono text-[11px] text-ink-muted">+ 6 more</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
