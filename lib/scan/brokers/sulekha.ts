// lib/scan/brokers/sulekha.ts
/**
 * Sulekha adapter (server-only, dependency-free).
 * Emits your RawHit shape (domain, label, url, kind?, fields?, risk?).
 * Gracefully falls back to a preview-style hit if fetch/parse is blocked.
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

export async function querySulekha(input: Partial<ScanInput>): Promise<RawHit[]> {
  const name = (input.name ?? "").trim();
  const city = (input.city ?? "").trim();
  const email = (input.email ?? "").trim();

  const qParts = [name, city].filter(Boolean).join(" ");
  const q = encodeURIComponent(qParts || email.split("@")[0] || "");
  const url = `https://www.sulekha.com/all_services?search=${q}`;

  if (!isAllowed(url)) return [];

  let html = "";
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { "user-agent": "Mozilla/5.0 (compatible; UnlistinBot/1.0; +https://unlistin.com)" },
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    if (r.ok) html = await r.text();
  } catch {
    // ignore; fallback below
  }

  const baseHit: Omit<RawHit, "url"> = {
    domain: "sulekha.com",
    label: "Sulekha",
    kind: "directory",
    fields: {
      email: email || undefined,
      name: name || undefined,
      city: city || undefined,
    },
    risk: "medium",
  };

  const fallback: RawHit = {
    ...baseHit,
    url,
    fields: {
      ...baseHit.fields,
      snippet:
        (name && city)
          ? `${name} possibly listed in ${city} on Sulekha.`
          : `Possible listing on Sulekha.`,
    },
  };

  if (!html) return [fallback];

  // Naive extraction: anchors with short titles
  const out: RawHit[] = [];
  const titleRe = /<a[^>]+?href="([^"]+)"[^>]*>([^<]{2,120})<\/a>/gi;
  let m: RegExpExecArray | null;
  let seen = 0;

  while ((m = titleRe.exec(html)) && seen < 5) {
    const href = m[1];
    const titleRaw = m[2] ?? "";
    const title = decodeHtml(titleRaw).trim();
    if (!href) continue;

    let link: string;
    try {
      const u = new URL(href, "https://www.sulekha.com");
      link = u.toString();
      if (!isAllowed(link)) continue;
    } catch {
      continue;
    }

    out.push({
      ...baseHit,
      url: link,
      fields: {
        ...baseHit.fields,
        snippet: title || baseHit.fields?.snippet,
      },
    });
    seen++;
  }

  return out.length > 0 ? out : [fallback];
}
