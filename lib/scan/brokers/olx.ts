// lib/scan/brokers/olx.ts
/**
 * OLX adapter (server-only). Emits safe search URLs for preview.
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

export async function queryOlx(input: Partial<ScanInput>): Promise<RawHit[]> {
  const name = (input.name ?? "").trim();
  const city = (input.city ?? "").trim();
  const email = (input.email ?? "").trim();

  const qBase = [name, city].filter(Boolean).join(" ");
  const q = encodeURIComponent(qBase || email.split("@")[0] || "");
  const urlIn = `https://www.olx.in/items/q-${q}`;
  const urlCom = `https://www.olx.com/items/q-${q}`;

  const urls = [urlIn, urlCom].filter(isAllowed);
  if (!urls.length) return [];

  const fields: Record<string, string> = {};
  if (name) fields.name = name;
  if (city) fields.city = city;
  if (email) fields.email = email;

  return urls.map((u) => ({
    url: u,
    label: "OLX",
    domain: u.includes(".in/") ? "olx.in" : "olx.com",
    kind: "people",
    fields,
    evidence: [
      name ? `Listings or profile possibly matching “${decodeHtml(name)}”` : "Classifieds/user profile surface",
      city ? `City context ~ “${decodeHtml(city)}”` : undefined,
    ].filter(Boolean) as string[],
    score: 0.52,
    adapter: "olx",
  }));
}
