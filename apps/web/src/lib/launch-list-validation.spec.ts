import { describe, expect, it } from "vitest";
import { isValidEmail } from "./launch-list-validation";

describe("isValidEmail", () => {
  it("accepts a plausible email", () => {
    expect(isValidEmail("ada@searchanvil.com")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isValidEmail("  ada@searchanvil.com  ")).toBe(true);
  });

  it.each(["", "not-an-email", "missing-at-sign.com", "no-domain@", "@no-local.com", "spaces in@email.com"])(
    "rejects %s",
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});
