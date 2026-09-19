import { describe, expect, it } from "vitest";
import { isActive } from "./Sidebar";

describe("isActive", () => {
  it("matches an exact path", () => {
    expect(isActive({ label: "Issues", href: "/app/projects/1/issues" }, "/app/projects/1/issues")).toBe(
      true,
    );
  });

  it("matches a nested path under the item href", () => {
    expect(
      isActive({ label: "Issues", href: "/app/projects/1/issues" }, "/app/projects/1/issues/42"),
    ).toBe(true);
  });

  it("does not match a sibling path that merely shares a prefix string", () => {
    expect(
      isActive({ label: "Issues", href: "/app/projects/1/issues" }, "/app/projects/1/issues-archive"),
    ).toBe(false);
  });

  it("does not match an unrelated path", () => {
    expect(isActive({ label: "Issues", href: "/app/projects/1/issues" }, "/app/projects/1/pages")).toBe(
      false,
    );
  });

  it("supports an explicit matchPrefix distinct from href", () => {
    expect(
      isActive(
        { label: "Overview", href: "/app/projects/1", matchPrefix: "/app/projects/1/overview" },
        "/app/projects/1/overview/details",
      ),
    ).toBe(true);
  });
});
