// lib/scan/brokers/shine.ts
/**
 * Shine adapter (server-only).
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

export async function queryShine(input: Partial<ScanInput>): Promise<RawHit[]> {
  const name = (input.name ?? "").trim();
  const city = (input.city ?? "").trim();
  const email = (input.email ?? "").trim();

  const q = encodeURIComponent([name, city].filter(Boolean).join(" ") || email.split("@")[0] || "");
  const url = `https://www.shine.com/jobs/${q}`;

  if (!isAllowed(url)) return [];

  const fields: Record<string, string> = {};
  if (name) fields.name = name;
  if (city) fields.city = city;
  if (email) fields.email = email;

  const hit: RawHit = {
    url,
    label: "Shine",
    domain: "shine.com",
    kind: "people",
    fields,
    evidence: [
      name ? `Possible listing or profile for “${decodeHtml(name)}”` : "Career portal profile surface",
      city ? `City context ~ “${decodeHtml(city)}”` : undefined,
    ].filter(Boolean) as string[],
    score: 0.49,
    adapter: "shine",
  };
  return [hit];
}
