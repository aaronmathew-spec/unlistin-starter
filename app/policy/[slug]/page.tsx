// app/policy/[slug]/page.tsx
import type { Metadata } from "next";
import { SITE, absoluteUrl } from "@/lib/seo";

type Props = { params: { slug: string } };

const COPIES: Record<string, { title: string; content: string }> = {
  privacy: {
    title: "Privacy Policy",
    content:
      "We respect your privacy. This page describes how UnlistIN collects, uses, and protects personal data...",
  },
  terms: {
    title: "Terms of Service",
    content:
      "Please read these terms carefully. By using UnlistIN, you agree to the following...",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = COPIES[params.slug] ?? { title: "Policy", content: SITE.defaultDescription };
  const title = `${item.title} · ${SITE.name}`;
  const url = absoluteUrl(`/policy/${params.slug}`);
  return {
    title,
    description: SITE.defaultDescription,
    alternates: { canonical: url },
    openGraph: { title, url, type: "article", siteName: SITE.name, images: [SITE.defaultImage] },
    twitter: { card: "summary_large_image", site: SITE.brandTwitter, title },
  };
}

export default function PolicyPage({ params }: Props) {
  const item = COPIES[params.slug];
  if (!item) return <div style={{ padding: 24 }}>Policy not found</div>;
  return (
    <main style={{ padding: 24, maxWidth: 880, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>{item.title}</h1>
      <p style={{ color: "#6b7280" }}>
        Updated: {new Date().toLocaleDateString()}
      </p>
      <article style={{ marginTop: 16, lineHeight: 1.65, color: "#111827" }}>
        {item.content}
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: item.title, url: absoluteUrl(`/policy/${params.slug}`) }) }}
      />
    </main>
  );
}
