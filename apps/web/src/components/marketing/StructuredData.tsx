import { CONTACT_EMAIL, SITE_NAME, SITE_ORIGIN } from "@/lib/site-config";

/**
 * JSON-LD structured data. Deliberately excludes AggregateRating/Review (no
 * real reviews exist) and Offer (no live billing exists — see
 * COMMERCIAL_STATE in site-config.ts). Each component renders a single
 * <script type="application/ld+json"> tag.
 */
function JsonLd({ data }: { data: Record<string, unknown> }): React.ReactElement {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- JSON.stringify output, not user input
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd(): React.ReactElement {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_ORIGIN,
        email: CONTACT_EMAIL,
        slogan: "Forge Better Search Performance",
      }}
    />
  );
}

export function WebSiteJsonLd(): React.ReactElement {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_ORIGIN,
      }}
    />
  );
}

/**
 * No `offers` field: the product is prelaunch with no live price to
 * transact against (see COMMERCIAL_STATE). Adding a fabricated Offer would
 * misrepresent purchasability to search engines.
 */
export function SoftwareApplicationJsonLd(): React.ReactElement {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Multi-tenant technical SEO auditing platform: website crawling, a Search Health score that stays explainable over time, ranked Forge Priorities issues, and crawl comparison.",
        url: SITE_ORIGIN,
      }}
    />
  );
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function FaqJsonLd({ items }: { items: Array<{ question: string; answer: string }> }): React.ReactElement {
  return <JsonLd data={faqJsonLd(items)} />;
}
