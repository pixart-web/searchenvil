import { describe, expect, it } from "vitest";
import { can, hasAtLeastRole } from "./roles";

describe("hasAtLeastRole", () => {
  it("ranks OWNER above ADMIN above MEMBER", () => {
    expect(hasAtLeastRole("OWNER", "ADMIN")).toBe(true);
    expect(hasAtLeastRole("ADMIN", "OWNER")).toBe(false);
    expect(hasAtLeastRole("ADMIN", "MEMBER")).toBe(true);
    expect(hasAtLeastRole("MEMBER", "ADMIN")).toBe(false);
  });

  it("treats equal roles as satisfying the requirement", () => {
    expect(hasAtLeastRole("MEMBER", "MEMBER")).toBe(true);
  });
});

describe("can", () => {
  it("lets OWNER manage billing but not lower roles", () => {
    expect(can("OWNER", "ORGANIZATION_MANAGE_BILLING")).toBe(true);
    expect(can("ADMIN", "ORGANIZATION_MANAGE_BILLING")).toBe(false);
    expect(can("MEMBER", "ORGANIZATION_MANAGE_BILLING")).toBe(false);
  });

  it("lets MEMBER start crawls", () => {
    expect(can("MEMBER", "CRAWL_START")).toBe(true);
  });

  it("requires ADMIN to delete a project", () => {
    expect(can("MEMBER", "PROJECT_DELETE")).toBe(false);
    expect(can("ADMIN", "PROJECT_DELETE")).toBe(true);
  });
});
