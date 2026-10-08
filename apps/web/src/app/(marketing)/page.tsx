import type { Metadata } from "next";
import { HomeClient } from "@/app/(marketing)/HomeClient";
import { SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "SearchAnvil — Technical SEO Audit Platform | Forge Better Search Performance",
  description:
    "SearchAnvil crawls your website and reveals the hidden structure beneath it — a Search Health score, issues ranked by impact and effort, and proof the fixes worked.",
  alternates: { canonical: SITE_ORIGIN },
  openGraph: {
    title: "SearchAnvil — Forge Better Search Performance",
    description:
      "A technical SEO audit platform: real crawl facts, a Search Health score, and issues ranked by impact and effort.",
    url: SITE_ORIGIN,
    siteName: "SearchAnvil",
    type: "website",
  },
};

export default function HomePage(): React.ReactElement {
  return <HomeClient />;
}
