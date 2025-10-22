// src/lib/seo.ts
export const SITE = {
  name: "UnlistIN",
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://example.com",
  brandTwitter: "@unlistin",
  defaultDescription:
    "UnlistIN — world-class automated removal platform for individuals & corporates. AI agents, proof vault, and verified dispatch.",
  defaultImage: "/og.png", // add a 1200x630 image in /public/og.png
};

export function absoluteUrl(path: string) {
  const base = SITE.url;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

// Minimal JSON-LD helpers
export function orgJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    sameAs: ["https://x.com/unlistin"].filter(Boolean),
    logo: absoluteUrl("/logo.png"), // add a small transparent logo in /public/logo.png
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE.url}/search?q={query}`,
      "query-input": "required name=query",
    },
  };
}
