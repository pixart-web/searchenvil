import { describe, expect, it } from "vitest";
import { extractPageFacts } from "./parser";

const BASE_URL = "https://example.com/blog/post-1";

describe("extractPageFacts", () => {
  it("extracts title, meta description, robots, and language", () => {
    const facts = extractPageFacts(
      `<html lang="en"><head>
        <title>  Hello   World  </title>
        <meta name="description" content="A great post">
        <meta name="robots" content="noindex, follow">
      </head><body></body></html>`,
      BASE_URL,
    );
    expect(facts.title).toBe("Hello World");
    expect(facts.metaDescription).toBe("A great post");
    expect(facts.metaRobots).toBe("noindex, follow");
    expect(facts.language).toBe("en");
  });

  it("returns undefined for absent title/description rather than empty string", () => {
    const facts = extractPageFacts("<html><head></head><body></body></html>", BASE_URL);
    expect(facts.title).toBeUndefined();
    expect(facts.metaDescription).toBeUndefined();
  });

  it("collects headings in document order across all levels", () => {
    const facts = extractPageFacts(
      "<h1>Main Title</h1><p>text</p><h2>Section</h2><h3>Sub</h3><h2>Another Section</h2>",
      BASE_URL,
    );
    expect(facts.headings).toEqual([
      { level: 1, text: "Main Title" },
      { level: 2, text: "Section" },
      { level: 3, text: "Sub" },
      { level: 2, text: "Another Section" },
    ]);
  });

  it("resolves a relative canonical URL against the page URL", () => {
    const facts = extractPageFacts('<link rel="canonical" href="/blog/post-1/">', BASE_URL);
    expect(facts.canonicalUrl).toBe("https://example.com/blog/post-1/");
  });

  it("counts visible body words, ignoring markup", () => {
    const facts = extractPageFacts(
      "<body><p>One two three</p><p>four five</p></body>",
      BASE_URL,
    );
    expect(facts.wordCount).toBe(5);
  });

  it("classifies links as internal or external based on origin", () => {
    const facts = extractPageFacts(
      `<a href="/about">About</a>
       <a href="https://example.com/contact">Contact</a>
       <a href="https://other.com/page">External</a>`,
      BASE_URL,
    );
    expect(facts.links).toHaveLength(3);
    expect(facts.links[0]!.isInternal).toBe(true);
    expect(facts.links[0]!.resolvedUrl).toBe("https://example.com/about");
    expect(facts.links[1]!.isInternal).toBe(true);
    expect(facts.links[2]!.isInternal).toBe(false);
  });

  it("distinguishes a missing alt attribute from an empty one", () => {
    const facts = extractPageFacts(
      '<img src="/a.png" alt="A description"><img src="/b.png" alt=""><img src="/c.png">',
      BASE_URL,
    );
    expect(facts.images).toEqual([
      { src: "/a.png", altText: "A description", hasAlt: true },
      { src: "/b.png", altText: undefined, hasAlt: true },
      { src: "/c.png", altText: undefined, hasAlt: false },
    ]);
  });

  it("parses valid JSON-LD structured data and extracts its @type", () => {
    const facts = extractPageFacts(
      `<script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","headline":"Hi"}
      </script>`,
      BASE_URL,
    );
    expect(facts.structuredData).toHaveLength(1);
    expect(facts.structuredData[0]!.isValid).toBe(true);
    expect(facts.structuredData[0]!.schemaType).toBe("Article");
  });

  it("marks malformed JSON-LD as invalid instead of throwing", () => {
    const facts = extractPageFacts(
      `<script type="application/ld+json">{ not valid json }</script>`,
      BASE_URL,
    );
    expect(facts.structuredData).toHaveLength(1);
    expect(facts.structuredData[0]!.isValid).toBe(false);
    expect(facts.structuredData[0]!.errors?.length).toBeGreaterThan(0);
  });

  it("extracts OpenGraph metadata", () => {
    const facts = extractPageFacts(
      `<meta property="og:title" content="Hello">
       <meta property="og:type" content="article">`,
      BASE_URL,
    );
    expect(facts.openGraph).toEqual([
      { property: "og:title", content: "Hello" },
      { property: "og:type", content: "article" },
    ]);
  });
});
