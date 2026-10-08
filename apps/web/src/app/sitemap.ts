import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";

const MARKETING_PATHS = [
  "/",
  "/platform",
  "/solutions/seo-professionals",
  "/solutions/agencies",
  "/solutions/in-house-teams",
  "/pricing",
  "/launch-list",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return MARKETING_PATHS.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
