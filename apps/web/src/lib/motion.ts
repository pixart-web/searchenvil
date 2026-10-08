"use client";

import { useEffect, useState } from "react";

/**
 * Shared reduced-motion hook. Every scroll-linked composition in
 * src/components/marketing/art checks this before registering any
 * GSAP/ScrollTrigger animation, and renders a fully static layout when it's
 * true — never a half-animated one.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent): void => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

/** Breakpoint used across the marketing site's motion code to shorten/replace desktop pins on mobile. */
export const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    setMobile(query.matches);
    const listener = (event: MediaQueryListEvent): void => setMobile(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return mobile;
}
