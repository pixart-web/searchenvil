"use client";

import { useLayoutEffect, useRef } from "react";
import { Badge } from "@searchanvil/ui";
import { ensureGsap } from "@/lib/gsap";
import { usePrefersReducedMotion, useIsMobile } from "@/lib/motion";

interface AnatomyPage {
  id: string;
  path: string;
  top: string;
  left: string;
  focus?: boolean;
}

const PAGES: AnatomyPage[] = [
  { id: "home", path: "/", top: "6%", left: "38%" },
  { id: "pricing", path: "/pricing", top: "12%", left: "68%" },
  { id: "blog", path: "/blog/2024-roundup", top: "42%", left: "8%" },
  { id: "product", path: "/products/anvil-pro", top: "36%", left: "58%" },
  { id: "docs", path: "/docs/getting-started", top: "66%", left: "30%" },
  { id: "old", path: "/checkout/legacy", top: "62%", left: "72%", focus: true },
];

const CONNECTIONS: Array<[string, string]> = [
  ["home", "pricing"],
  ["home", "blog"],
  ["home", "product"],
  ["product", "docs"],
  ["blog", "old"],
  ["docs", "old"],
];

/**
 * Scene 2 artwork: the pages that make up a real website, first shown as a
 * flat cluster, then broken apart into separated layers with their internal
 * links drawn as connective lines, then one affected page (a page whose
 * legacy link now 404s) focuses while the rest recede — "website anatomy"
 * made visible. Positions/connections are illustrative, not a real crawl.
 */
export function WebsiteAnatomy(): React.ReactElement {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    if (reducedMotion || !sectionRef.current || !stageRef.current) return;
    const gsap = ensureGsap();

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".anatomy-page");
      const lines = gsap.utils.toArray<SVGLineElement>(".anatomy-line");
      const focusCard = stageRef.current?.querySelector<HTMLElement>('[data-focus="true"]');
      const nonFocusCards = cards.filter((c) => c.dataset.focus !== "true");

      gsap.set(lines, { opacity: 0 });
      gsap.set(cards, { scale: 0.92, y: 10 });

      const scrollTriggerConfig = isMobile
        ? { trigger: sectionRef.current, start: "top 75%", end: "bottom 40%", scrub: 0.5 }
        : { trigger: sectionRef.current, start: "top top", end: "+=140%", scrub: 0.6, pin: true, pinSpacing: true };

      const tl = gsap.timeline({ scrollTrigger: scrollTriggerConfig });

      // Stage 1: pages settle into their separated layer positions.
      tl.to(cards, { scale: 1, y: 0, duration: 1, ease: "none", stagger: 0.03 }, 0);
      // Stage 2: connections draw between them.
      tl.to(lines, { opacity: 1, duration: 0.6, ease: "none" }, 0.5);
      // Stage 3: one affected page focuses, the rest recede.
      if (focusCard) {
        tl.to(focusCard, { scale: 1.18, zIndex: 20, duration: 0.8, ease: "none" }, 1.1);
        tl.to(nonFocusCards, { opacity: 0.25, duration: 0.8, ease: "none" }, 1.1);
        tl.to(lines, { opacity: 0.15, duration: 0.6, ease: "none" }, 1.1);
      }
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion, isMobile]);

  return (
    <div ref={sectionRef} className="relative">
      <div ref={stageRef} className="relative mx-auto h-[420px] w-full max-w-4xl px-6 sm:h-[480px]">
        <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {CONNECTIONS.map(([fromId, toId]) => {
            const from = PAGES.find((p) => p.id === fromId);
            const to = PAGES.find((p) => p.id === toId);
            if (!from || !to) return null;
            return (
              <line
                key={`${fromId}-${toId}`}
                className="anatomy-line"
                x1={from.left}
                y1={from.top}
                x2={to.left}
                y2={to.top}
                stroke="#3A4250"
                strokeWidth={1.5}
                style={reducedMotion ? undefined : { opacity: isMobile ? 1 : undefined }}
              />
            );
          })}
        </svg>

        {PAGES.map((page) => (
          <div
            key={page.id}
            data-focus={page.focus ? "true" : undefined}
            className="anatomy-page absolute w-32 -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-forge-900 p-2.5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] sm:w-44 sm:p-3"
            style={{
              top: page.top,
              left: `clamp(18%, ${page.left}, 82%)`,
              borderColor: page.focus ? "#EF9856" : "#1D232C",
            }}
          >
            <p className="truncate font-mono text-[11px] text-steel-300">{page.path}</p>
            {page.focus ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <Badge tone="danger">404</Badge>
                <span className="font-mono text-[10px] text-steel-600">2 broken links</span>
              </div>
            ) : (
              <div className="mt-2 h-1.5 w-2/3 rounded-full bg-forge-800" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
