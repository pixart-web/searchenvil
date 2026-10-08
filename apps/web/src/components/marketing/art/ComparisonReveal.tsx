"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Badge, SearchHealthGauge } from "@searchanvil/ui";
import { ensureGsap } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * Scene 5 artwork: a scroll-linked before/after reveal of two crawls of the
 * same site (Search Health, fixed/new issue counts) — a clip-path wipe
 * driven by scroll progress. A real, always-available toggle button sits
 * alongside it so the same reveal works without scrolling at all (keyboard,
 * screen reader, or reduced motion), per the "accessible non-scroll
 * control" requirement — it isn't decoration, it's the primary control for
 * anyone who can't or doesn't want to scroll-scrub.
 */
export function ComparisonReveal(): React.ReactElement {
  const sectionRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const [manualReveal, setManualReveal] = useState(50);
  const reducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (reducedMotion || !sectionRef.current || !afterRef.current) return;
    const gsap = ensureGsap();

    const ctx = gsap.context(() => {
      gsap.fromTo(
        afterRef.current,
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)",
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            end: "bottom 40%",
            scrub: 0.6,
            onUpdate: (self) => setManualReveal(Math.round(self.progress * 100)),
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  const clip = `inset(0 ${100 - manualReveal}% 0 0)`;

  return (
    <div ref={sectionRef} className="mx-auto max-w-3xl px-6">
      <div className="relative overflow-hidden rounded-xl border border-forge-800 bg-forge-900">
        {/* Before (base layer, always visible) */}
        <div className="grid grid-cols-2 gap-6 p-8">
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-600">Crawl — Aug 1</p>
            <SearchHealthGauge score={54} size={104} />
            <div className="flex gap-1.5">
              <Badge tone="danger">18 open</Badge>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-600">Crawl — Sep 1</p>
            <SearchHealthGauge score={71} size={104} />
            <div className="flex gap-1.5">
              <Badge tone="success">12 fixed</Badge>
              <Badge tone="danger">3 new</Badge>
            </div>
          </div>
        </div>

        {/* After (revealed layer, clipped) */}
        <div
          ref={afterRef}
          className="pointer-events-none absolute inset-0 grid grid-cols-2 gap-6 bg-forge-900 p-8"
          style={reducedMotion ? { clipPath: clip } : undefined}
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember-400">Now revealed</p>
            <SearchHealthGauge score={54} size={104} />
          </div>
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember-400">+17 points</p>
            <SearchHealthGauge score={71} size={104} />
          </div>
        </div>

        <p className="border-t border-forge-800 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-steel-600">
          Illustrative data
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="comparison-reveal-slider" className="font-mono text-xs text-steel-500">
          Compare crawls
        </label>
        <input
          id="comparison-reveal-slider"
          type="range"
          min={0}
          max={100}
          value={manualReveal}
          onChange={(event) => {
            const value = Number(event.target.value);
            setManualReveal(value);
            if (afterRef.current) {
              afterRef.current.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
            }
          }}
          className="h-1.5 flex-1 accent-ember-500"
          aria-label="Slide to compare the Sep 1 crawl against the Aug 1 crawl"
        />
        <span className="font-mono text-xs text-steel-500" aria-hidden="true">
          {manualReveal}%
        </span>
      </div>
    </div>
  );
}
