import { chromium, type Browser } from "playwright-core";
import { isValidHttpUrl } from "@searchenvil/shared";
import type { CollectOptions, MetricsCollector, PerformanceMetrics } from "./types";

/**
 * A single, short-lived browser instance per collect() call — deliberately
 * not a shared/pooled browser. Performance jobs run at low concurrency (see
 * docs/PERFORMANCE.md), so the overhead of a fresh launch per page is an
 * acceptable trade for never leaking browser state between analyses.
 *
 * `executablePath` must point at a provisioned Chromium (see
 * docs/DEPLOYMENT.md) — this package intentionally uses `playwright-core`,
 * not `playwright`, so installing this package never silently downloads a
 * ~150MB browser as a side effect of `pnpm install`.
 */
export function createPlaywrightCollector(executablePath: string): MetricsCollector {
  return async function collect(url: string, options: CollectOptions): Promise<PerformanceMetrics> {
    if (!isValidHttpUrl(url)) {
      return { status: "FAILED", errorMessage: `Not an http(s) URL: ${url}` };
    }

    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ executablePath, headless: true });
      const page = await browser.newPage({ userAgent: options.userAgent });
      page.setDefaultTimeout(options.timeoutMs);
      page.setDefaultNavigationTimeout(options.timeoutMs);

      // Collect LCP/CLS via PerformanceObserver before navigating, so we
      // don't miss entries that fire during the initial paint.
      await page.addInitScript(() => {
        (window as unknown as { __searchenvilMetrics: { lcp: number; cls: number } }).__searchenvilMetrics = {
          lcp: 0,
          cls: 0,
        };
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last) {
              (window as unknown as { __searchenvilMetrics: { lcp: number } }).__searchenvilMetrics.lcp =
                last.startTime;
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });

          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
              if (!entry.hadRecentInput) {
                (window as unknown as { __searchenvilMetrics: { cls: number } }).__searchenvilMetrics.cls +=
                  entry.value;
              }
            }
          }).observe({ type: "layout-shift", buffered: true });
        } catch {
          // Observers unsupported in this engine — metrics simply stay at 0/undefined.
        }
      });

      await page.goto(url, { waitUntil: "load", timeout: options.timeoutMs });
      // Give LCP/CLS observers a brief window after load to settle.
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const custom = (window as unknown as { __searchenvilMetrics: { lcp: number; cls: number } })
          .__searchenvilMetrics;
        return {
          ttfbMs: nav ? Math.round(nav.responseStart) : undefined,
          domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : undefined,
          loadTimeMs: nav ? Math.round(nav.loadEventEnd) : undefined,
          lcpMs: custom?.lcp ? Math.round(custom.lcp) : undefined,
          cls: custom?.cls,
        };
      });

      return { status: "COMPLETED", ...result };
    } catch (error) {
      return {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown performance analysis error",
      };
    } finally {
      await browser?.close().catch(() => undefined);
    }
  };
}
