import { describe, expect, it } from "vitest";
import { COMMERCIAL_STATE, IS_PRELAUNCH, PRICING } from "./site-config";

// The site has no billing/checkout code path anywhere in the repo — these
// assertions exist so a future edit that accidentally flips the commercial
// state (without actually building real billing) fails CI instead of
// silently shipping a "live" pricing page with nothing behind it.
describe("commercial state", () => {
  it("defaults to prelaunch", () => {
    expect(COMMERCIAL_STATE).toBe("prelaunch");
    expect(IS_PRELAUNCH).toBe(true);
  });

  it("always frames the displayed price as an expectation, not a live offer", () => {
    expect(PRICING.framing.toLowerCase()).toContain("expected");
    expect(PRICING.displayFull).toBe(`${PRICING.currencySymbol}${PRICING.amount}/${PRICING.interval}`);
  });
});
