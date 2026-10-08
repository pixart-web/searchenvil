import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Never let crawlers into the authenticated product, auth flows, the
        // launch-list API route, or internal dev-only reference pages.
        disallow: ["/app/", "/login", "/register", "/onboarding", "/api/", "/dev/"],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
