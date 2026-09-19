import * as cheerio from "cheerio";
import { isSameOrigin } from "@searchenvil/shared";
import type {
  HeadingFact,
  ImageFact,
  LinkFact,
  OpenGraphFact,
  PageFacts,
  StructuredDataFact,
} from "./types";

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function resolveUrl(href: string, base: string): string | undefined {
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

export function extractPageFacts(html: string, pageUrl: string): PageFacts {
  const $ = cheerio.load(html);

  const title = collapseWhitespace($("head > title").first().text()) || undefined;
  const metaDescription =
    $('meta[name="description" i]').first().attr("content")?.trim() || undefined;
  const metaRobots = $('meta[name="robots" i]').first().attr("content")?.trim() || undefined;
  const language = $("html").attr("lang")?.trim() || undefined;

  const canonicalHref = $('link[rel="canonical" i]').first().attr("href");
  const canonicalUrl = canonicalHref ? resolveUrl(canonicalHref, pageUrl) : undefined;

  const headings: HeadingFact[] = [];
  $(HEADING_SELECTOR).each((_, el) => {
    const tag = (el as { tagName?: string; name?: string }).tagName ?? (el as { name: string }).name;
    const level = Number(tag.replace(/[^0-9]/g, "")) as HeadingFact["level"];
    const text = collapseWhitespace($(el).text());
    if (text) {
      headings.push({ level, text });
    }
  });

  // cheerio's .text() concatenates block-level elements with no separator
  // ("<p>a</p><p>b</p>" -> "ab"), unlike a rendered browser. Insert a space
  // after each block-level element first so word counting matches what a
  // reader actually sees.
  $("p, div, li, br, h1, h2, h3, h4, h5, h6, tr, section, article, header, footer").after(" ");
  const bodyText = collapseWhitespace($("body").text());
  const wordCount = bodyText ? bodyText.split(" ").filter(Boolean).length : 0;

  const links: LinkFact[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const resolvedUrl = resolveUrl(href, pageUrl);
    links.push({
      href,
      resolvedUrl,
      isInternal: resolvedUrl ? isSameOrigin(resolvedUrl, pageUrl) : false,
      anchorText: collapseWhitespace($(el).text()),
      rel: $(el).attr("rel")?.trim() || undefined,
    });
  });

  const images: ImageFact[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const hasAlt = $(el).attr("alt") !== undefined;
    images.push({
      src,
      altText: $(el).attr("alt")?.trim() || undefined,
      hasAlt,
    });
  });

  const structuredData: StructuredDataFact[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const parsed: unknown = JSON.parse(raw);
      const schemaType = extractSchemaType(parsed);
      structuredData.push({ format: "json-ld", schemaType, raw: parsed, isValid: true, errors: undefined });
    } catch (error) {
      structuredData.push({
        format: "json-ld",
        schemaType: undefined,
        raw,
        isValid: false,
        errors: [error instanceof Error ? error.message : "Invalid JSON"],
      });
    }
  });

  const openGraph: OpenGraphFact[] = [];
  $('meta[property^="og:" i]').each((_, el) => {
    const property = $(el).attr("property");
    const content = $(el).attr("content");
    if (property && content !== undefined) {
      openGraph.push({ property, content });
    }
  });

  return {
    title,
    metaDescription,
    headings,
    canonicalUrl,
    metaRobots,
    language,
    wordCount,
    links,
    images,
    structuredData,
    openGraph,
  };
}

function extractSchemaType(parsed: unknown): string | undefined {
  if (parsed && typeof parsed === "object" && "@type" in parsed) {
    const type = (parsed as { "@type": unknown })["@type"];
    if (typeof type === "string") return type;
    if (Array.isArray(type) && typeof type[0] === "string") return type[0];
  }
  return undefined;
}
