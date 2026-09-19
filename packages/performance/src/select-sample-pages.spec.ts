import { describe, expect, it } from "vitest";
import { selectSamplePages, type SamplePageCandidate } from "./select-sample-pages";

function page(overrides: Partial<SamplePageCandidate>): SamplePageCandidate {
  return { id: "id", normalizedUrl: "https://example.com/", depth: 0, statusCode: 200, ...overrides };
}

describe("selectSamplePages", () => {
  it("excludes pages that didn't return 200", () => {
    const candidates = [page({ id: "a", statusCode: 200 }), page({ id: "b", statusCode: 404 })];
    expect(selectSamplePages(candidates, 5).map((p) => p.id)).toEqual(["a"]);
  });

  it("prioritizes shallower pages first", () => {
    const candidates = [
      page({ id: "deep", depth: 2, normalizedUrl: "https://example.com/deep" }),
      page({ id: "home", depth: 0, normalizedUrl: "https://example.com/" }),
      page({ id: "mid", depth: 1, normalizedUrl: "https://example.com/mid" }),
    ];
    expect(selectSamplePages(candidates, 5).map((p) => p.id)).toEqual(["home", "mid", "deep"]);
  });

  it("caps the result at maxSamples", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      page({ id: `p${i}`, normalizedUrl: `https://example.com/${i}`, depth: 1 }),
    );
    expect(selectSamplePages(candidates, 5)).toHaveLength(5);
  });

  it("breaks ties at the same depth by URL, deterministically", () => {
    const candidates = [
      page({ id: "b", depth: 1, normalizedUrl: "https://example.com/b" }),
      page({ id: "a", depth: 1, normalizedUrl: "https://example.com/a" }),
    ];
    const first = selectSamplePages(candidates, 5).map((p) => p.id);
    const second = selectSamplePages([...candidates].reverse(), 5).map((p) => p.id);
    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(first);
  });

  it("returns an empty array when maxSamples is 0", () => {
    expect(selectSamplePages([page({})], 0)).toEqual([]);
  });

  it("uses the default cap when none is given", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      page({ id: `p${i}`, normalizedUrl: `https://example.com/${i}`, depth: 1 }),
    );
    expect(selectSamplePages(candidates)).toHaveLength(5);
  });
});
