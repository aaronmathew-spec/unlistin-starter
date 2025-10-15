// lib/scan/brokers/truecaller.ts
/**
 * Truecaller adapter (server-only, dependency-free).
 * We DO NOT scrape or log PII. We only produce allowlisted, user-facing URLs
 * and conservative preview metadata for ranking.
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

export async function queryTruecaller(input: Partial<ScanInput>): Promise<RawHit[]> {
  const name = (input.name ?? "").trim();
  const city = (input.city ?? "").trim();
  const email = (input.email ?? "").trim();

  // We prefer name + city as a benign public query for preview
  const qParts = [name, city].filter(Boolean).join(" ");
  const q = encodeURIComponent(qParts || email.split("@")[0] || "");
  const url = `https://www.truecaller.com/search/in/${q}`;

  if (!isAllowed(url)) return [];

  const fields: Record<string, any> = {};
  if (name) fields.name = name;
  if (city) fields.city = city;
  if (email) fields.email = email;

  // We don’t fetch the page here; we emit a preview RawHit
  const hit: RawHit = {
    url,
    label: "Truecaller",
    domain: "truecaller.com",
    kind: "people",
    fields,
    evidence: [
      name ? `Likely match for name ~ “${decodeHtml(name)}”` : "People directory surface",
      city ? `City context ~ “${decodeHtml(city)}”` : undefined,
    ].filter(Boolean) as string[],
    score: 0.62,
    adapter: "truecaller",
  };
  return [hit];
}
