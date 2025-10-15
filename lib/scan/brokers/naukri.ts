// lib/scan/brokers/naukri.ts
/**
 * Naukri adapter (server-only). Emits safe public search URLs for preview.
 */
import { isAllowed } from "@/lib/scan/domains-allowlist";
import type { RawHit, ScanInput } from "@/lib/scan/normalize";

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

export async function queryNaukri(input: Partial<ScanInput>): Promise<RawHit[]> {
  const name = (input.name ?? "").trim();
  const city = (input.city ?? "").trim();
  const email = (input.email ?? "").trim();

  const qBase = [name, city].filter(Boolean).join(" ");
  const q = encodeURIComponent(qBase || email.split("@")[0] || "");
  const url = `https://www.naukri.com/${q}-jobs`;

  if (!isAllowed(url)) return [];

  const fields: Record<string, string> = {};
  if (name) fields.name = name;
  if (city) fields.city = city;
  if (email) fields.email = email;

  const hit: RawHit = {
    url,
    label: "Naukri",
    domain: "naukri.com",
    kind: "people",
    fields,
    evidence: [
      name ? `Likely career profile or mention for “${decodeHtml(name)}”` : "Career/job profile surface",
      city ? `City context ~ “${decodeHtml(city)}”` : undefined,
    ].filter(Boolean) as string[],
    score: 0.56,
    adapter: "naukri",
  };
  return [hit];
}
