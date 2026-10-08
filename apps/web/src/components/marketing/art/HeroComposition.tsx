"use client";

import { useLayoutEffect, useRef } from "react";
import { ensureGsap } from "@/lib/gsap";
import { usePrefersReducedMotion, useIsMobile } from "@/lib/motion";

/**
 * Scene 1 hero artwork — rebuilt to match the approved reference mockup's
 * layout: a fanned stack of translucent dashboard panels in 3D, connected
 * by thin copper light lines, floating above a dark rocky ground with a
 * warm copper glow beneath it.
 *
 * Two pieces are a stylized CSS/SVG approximation rather than a photographic
 * match, and are called out as such in docs/MARKETING_SITE.md: the rocky
 * ground silhouette (`.hero-ground`) and the copper glow beneath it
 * (`.hero-glow`). No photorealistic image-generation tool is available in
 * this environment, so the reference's painterly "anvil on rock" backdrop
 * is approximated with layered gradients/clip-paths instead of redrawn or
 * faked as a raster image.
 *
 * The front-most panel is the one piece of real product UI in the
 * composition: an "Illustrative data" Overview panel built from the same
 * primitives/labels the real /app/projects/[projectId] overview uses
 * (Search Health ring, issue counts, category donut) — see
 * docs/MARKETING_SITE.md for why this is illustrative rather than a live
 * screenshot (the demo seed has no crawl/issue data to screenshot, and the
 * reference shows metrics — indexed pages, avg page speed, issues-over-time
 * — that don't exist in the real API yet).
 */

const BACK_PANELS = [
  { id: "technical", label: "Technical SEO", trend: [8, 14, 10, 18, 15, 22, 19, 26] },
  { id: "pages", label: "Page analysis", trend: [20, 16, 18, 12, 15, 10, 13, 9] },
  { id: "tracking", label: "Change tracking", trend: [6, 9, 7, 13, 11, 17, 14, 20] },
] as const;

const ISSUE_DISTRIBUTION = [
  { label: "Critical", value: 24, color: "#E65353" },
  { label: "High", value: 48, color: "#E3A72F" },
  { label: "Medium", value: 52, color: "#F3AD75" },
  { label: "Low", value: 18, color: "#36B978" },
] as const;

const ISSUES_SPARK = [7, 6, 8, 5, 6, 4, 5, 3, 4, 2, 3, 2];
const CRAWL_BARS = [40, 55, 45, 60, 70, 65, 80, 72, 85, 78, 90, 82];

function sparklinePoints(values: number[], width: number, height: number): string {
  const max = Math.max(...values);
  const step = width / (values.length - 1);
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(" ");
}

function DonutChart({ size = 56 }: { size?: number }): React.ReactElement {
  const total = ISSUE_DISTRIBUTION.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {ISSUE_DISTRIBUTION.map((segment) => {
        const length = (segment.value / total) * circumference;
        const dash = `${length} ${circumference - length}`;
        const el = (
          <circle
            key={segment.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={6}
            strokeDasharray={dash}
            strokeDashoffset={-offset}
          />
        );
        offset += length;
        return el;
      })}
    </svg>
  );
}

function OverviewPanel(): React.ReactElement {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-forge-800 bg-forge-900/95 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-forge-800 bg-forge-850/90 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-ember-500" />
        <span className="truncate font-mono text-[11px] text-steel-400">example.com</span>
        <span className="ml-auto hidden rounded bg-ember-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ember-400 sm:inline">
          Overview
        </span>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2.5 p-3">
        <div className="col-span-1 flex items-center gap-2.5 rounded-lg border border-forge-800 bg-forge-850/80 p-2.5">
          <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 shrink-0">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#1D232C" strokeWidth="5" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="#36B978"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={2 * Math.PI * 18 * (1 - 0.78)}
            />
          </svg>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Health</p>
            <p className="text-lg font-semibold leading-none text-steel-100">
              78 <span className="text-[10px] font-normal text-success">+6</span>
            </p>
          </div>
        </div>

        <div className="col-span-1 rounded-lg border border-forge-800 bg-forge-850/80 p-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Issues</p>
          <p className="text-lg font-semibold leading-none text-steel-100">
            142 <span className="text-[10px] font-normal text-danger">-28</span>
          </p>
          <svg viewBox="0 0 60 18" className="mt-1.5 h-4 w-full" preserveAspectRatio="none">
            {ISSUES_SPARK.map((v, i) => (
              <rect key={i} x={i * 5} y={18 - v * 1.6} width="3.4" height={v * 1.6} fill="#E65353" opacity={0.75} />
            ))}
          </svg>
        </div>

        <div className="col-span-1 rounded-lg border border-forge-800 bg-forge-850/80 p-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Indexed pages</p>
          <p className="text-lg font-semibold leading-none text-steel-100">
            8,421 <span className="text-[10px] font-normal text-success">+2%</span>
          </p>
          <svg viewBox="0 0 60 18" className="mt-1.5 h-4 w-full" preserveAspectRatio="none">
            <polyline points={sparklinePoints([4, 6, 5, 8, 7, 9, 11, 10], 60, 16)} fill="none" stroke="#36B978" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="col-span-1 rounded-lg border border-forge-800 bg-forge-850/80 p-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-600">Avg page speed</p>
          <p className="text-lg font-semibold leading-none text-steel-100">
            1.9s <span className="text-[10px] font-normal text-success">-0.4s</span>
          </p>
          <svg viewBox="0 0 60 18" className="mt-1.5 h-4 w-full" preserveAspectRatio="none">
            <polyline points={sparklinePoints([9, 8, 9, 7, 6, 7, 5, 4], 60, 16)} fill="none" stroke="#36B978" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="col-span-2 flex items-center gap-3 rounded-lg border border-forge-800 bg-forge-850/80 p-2.5">
          <DonutChart size={48} />
          <div className="flex flex-1 flex-col gap-1">
            {ISSUE_DISTRIBUTION.map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="flex items-center gap-1.5 text-steel-400">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.label}
                </span>
                <span className="font-mono text-steel-300">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="border-t border-forge-800 bg-forge-950/80 px-4 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-steel-600">
        Illustrative data
      </p>
    </div>
  );
}

function BackPanel({ label, trend }: { label: string; trend: readonly number[] }): React.ReactElement {
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-xl border border-forge-700/60 bg-forge-900/40 p-3 backdrop-blur-[2px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-steel-500">{label}</p>
      <svg viewBox="0 0 80 28" className="h-7 w-full" preserveAspectRatio="none">
        <polyline points={sparklinePoints([...trend], 80, 26)} fill="none" stroke="#EF9856" strokeWidth="1.5" opacity={0.8} />
      </svg>
    </div>
  );
}

/**
 * Pinned scroll choreography: layers fan apart and the scanline sweeps as
 * the user scrolls, the hero copy exits, then the whole stage straightens
 * and grows to hand off into the next scene. Mobile skips the pin (per the
 * established mobile rule) and plays a single settle-in animation instead.
 */
export function HeroComposition({ copyRef }: { copyRef: React.RefObject<HTMLDivElement | null> }): React.ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    if (reducedMotion || !root.current || !stageRef.current) return;
    const gsap = ensureGsap();

    const ctx = gsap.context(() => {
      const backPanels = gsap.utils.toArray<HTMLElement>(".hero-back-panel");

      if (isMobile) {
        gsap.fromTo(
          stageRef.current,
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: { trigger: stageRef.current, start: "top 85%" },
          },
        );
        return;
      }

      gsap.set(backPanels, { autoAlpha: 0, z: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=100%",
          scrub: 0.6,
          pin: true,
          pinSpacing: true,
        },
      });

      tl.to(backPanels, { autoAlpha: 1, stagger: 0.08, duration: 0.6, ease: "none" }, 0)
        .to(copyRef.current, { autoAlpha: 0, y: -60, duration: 1, ease: "none" }, 0.1)
        .to(stageRef.current, { rotateY: 0, rotateX: 0, scale: 1.06, duration: 1, ease: "none" }, 0)
        .to(".hero-scanline", { top: "110%", duration: 1, ease: "none" }, 0);
    }, root);

    return () => ctx.revert();
  }, [reducedMotion, isMobile, copyRef]);

  return (
    <div ref={root} className="relative">
      {/* Stylized CSS/SVG approximation of the reference's "anvil on rock,
          copper glow" backdrop — not a photographic match (no image-gen
          tool is available here). See docs/MARKETING_SITE.md. */}
      <div aria-hidden="true" className="hero-ground pointer-events-none absolute inset-x-0 bottom-0 h-[55%] overflow-hidden">
        <div
          className="hero-glow absolute left-1/2 top-[30%] h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(ellipse at center, rgba(239,152,86,0.55), rgba(239,152,86,0.08) 55%, transparent 75%)" }}
        />
        <svg viewBox="0 0 1200 300" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-full w-full">
          <polygon
            points="0,300 0,190 90,160 180,210 280,150 360,195 460,140 560,185 650,130 760,175 860,120 970,170 1060,135 1160,180 1200,150 1200,300"
            fill="#0C0F13"
          />
          <polygon
            points="0,300 0,230 120,205 240,245 340,195 450,235 560,185 670,225 780,180 900,220 1020,175 1120,215 1200,195 1200,300"
            fill="#14181E"
            opacity={0.85}
          />
        </svg>
      </div>

      <div
        className="relative mx-auto flex justify-center px-6 pb-28 pt-6 sm:justify-end sm:pb-36 sm:pr-10 lg:pr-20"
        style={{ perspective: reducedMotion || isMobile ? undefined : "1600px" }}
      >
        <div
          ref={stageRef}
          className="relative h-[360px] w-full max-w-xl sm:h-[420px] sm:max-w-2xl"
          style={
            reducedMotion || isMobile
              ? undefined
              : { transformStyle: "preserve-3d", transform: "rotateY(-16deg) rotateX(8deg)" }
          }
        >
          {/* Thin copper connecting lines between the fanned panels — desktop only, part of the 3D fan. */}
          {!reducedMotion && !isMobile ? (
            <svg aria-hidden="true" className="pointer-events-none absolute -right-4 top-6 h-[90%] w-[70%] opacity-60" viewBox="0 0 300 300">
              <line x1="0" y1="60" x2="300" y2="20" stroke="#EF9856" strokeWidth="1" opacity={0.5} />
              <line x1="0" y1="140" x2="300" y2="110" stroke="#EF9856" strokeWidth="1" opacity={0.5} />
              <line x1="0" y1="220" x2="300" y2="200" stroke="#EF9856" strokeWidth="1" opacity={0.5} />
            </svg>
          ) : null}

          {/* Back panels: fanned out in 3D on desktop; a simple flat stack on mobile (no translateZ/rotateY, to avoid edge clipping at narrow widths). */}
          {BACK_PANELS.map((panel, i) => (
            <div
              key={panel.id}
              className="hero-back-panel absolute right-0 top-0 hidden h-32 w-40 sm:block sm:h-36 sm:w-44"
              style={
                reducedMotion || isMobile
                  ? undefined
                  : {
                      transform: `translate3d(${(i + 1) * 54}px, ${-(i + 1) * 18}px, ${-(i + 1) * 70}px) rotateY(18deg)`,
                      opacity: reducedMotion ? 1 : undefined,
                    }
              }
            >
              <BackPanel label={panel.label} trend={panel.trend} />
            </div>
          ))}

          {/* Front panel: the real, readable Overview dashboard. */}
          <div
            className="absolute bottom-0 left-0 h-[340px] w-full sm:h-[360px]"
            style={reducedMotion || isMobile ? undefined : { transform: "translateZ(40px)" }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-xl">
              <OverviewPanel />
              {!reducedMotion ? (
                <div
                  className="hero-scanline pointer-events-none absolute left-0 top-0 h-20 w-full bg-gradient-to-b from-ember-500/0 via-ember-500/15 to-ember-500/0"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          </div>

          {/* Faint crawl-activity bar chart riding along the ground plane, echoing the reference's lower-right bars. */}
          <div className="absolute -bottom-10 right-0 hidden h-14 w-48 items-end gap-0.5 opacity-50 sm:flex" aria-hidden="true">
            {CRAWL_BARS.map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-ember-500/40" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
