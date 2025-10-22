// app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Add any marketing/policy urls you have live
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/policy/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/policy/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/help`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];
  return pages;
}
