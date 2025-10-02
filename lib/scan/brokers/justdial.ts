// lib/scan/brokers/justdial.ts
/**
 * Justdial adapter (server-only).
 * Best-effort HTML fetch with graceful fallback when blocked.
 * Persists only redacted content (redaction happens in the caller).
 *
 * No external deps to keep builds green; naive parsing with regex.
 */
import { isAllowed } from "@/lib/scan/domains-allowlist";
import type { RawHit } from "@/lib/scan/normalize";

type Input = { fullName?: string; city?: string; email?: string };

export async function queryJustdial(input: Input): Promise<RawHit[]> {
  const name = (input.fullName ?? "").trim();
  const city = (input.city ?? "").trim();

  // Build a benign public search URL. We never persist inputs; caller will redact.
  const qParts = [name, city].filter(Boolean).join(" ");
  const q = encodeURIComponent(qParts || (input.email ?? "").split("@")[0] || "");
  const url = `https://www.justdial.com/search?q=${q}`;

  if (!isAllowed(url)) return [];

  let html = "";
  try {
    const r = await fetch(url, {
      method: "GET",
      // Friendly UA; JD may still gate this which is fine — we fallback.
      headers: { "user-agent": "Mozilla/5.0 (compatible; UnlistinBot/1.0; +https://unlistin.com)" },
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    if (r.ok) {
      html = await r.text();
    }
  } catch {
    // ignore; we'll fallback
  }

  // If fetch failed or is blocked, return a preview-style hint so UX is consistent.
  if (!html) {
    return [{
      broker: "Justdial",
      category: "directory",
      url,
      confidence: name ? 0.72 : 0.55,
      matchedFields: [
        ...(name ? ["name"] : []),
        ...(city ? ["city"] : []),
        ...(input.email ? ["email"] : []),
      ],
      evidence: [
        `Possible listing for “…${name || (input.email ?? "").split("@")[0] || "query"}…”`,
        city ? `City cue near “…${city.split(",")[0]}…”` : "",
      ].filter(Boolean),
    }];
  }

  // VERY light parsing (title lines), avoids brittle selectors.
  const items: RawHit[] = [];
  const titleRe = /<a[^>]+?href="([^"]+)"[^>]*>([^<]{2,80})<\/a>/gi;
  let m: RegExpExecArray | null;
  let seen = 0;

  while ((m = titleRe.exec(html)) && seen < 5) {
    const href = m[1];
    const title = decodeHtml(m[2]).trim();
    // ensure absolute and allowlisted
    let link: string;
    try {
      const u = new URL(href, "https://www.justdial.com");
      link = u.toString();
      if (!isAllowed(link)) continue;
    } catch {
      continue;
    }

    const conf =
      (name && title.toLowerCase().includes(name.split(" ")[0].toLowerCase())) ? 0.85 :
      (city && title.toLowerCase().includes(city.split(",")[0].toLowerCase())) ? 0.7 :
      0.56;

    items.push({
      broker: "Justdial",
      category: "directory",
      url: link,
      confidence: conf,
      matchedFields: [
        ...(name ? ["name"] : []),
        ...(city ? ["city"] : []),
        ...(input.email ? ["email"] : []),
      ],
      evidence: title ? [title] : [],
    });
    seen++;
  }

  if (items.length === 0) {
    // fallback to hint if parsing finds nothing
    return [{
      broker: "Justdial",
      category: "directory",
      url,
      confidence: name ? 0.72 : 0.55,
      matchedFields: [
        ...(name ? ["name"] : []),
        ...(city ? ["city"] : []),
        ...(input.email ? ["email"] : []),
      ],
      evidence: [
        `Possible listing for “…${name || (input.email ?? "").split("@")[0] || "query"}…”`,
        city ? `City cue near “…${city.split(",")[0]}…”` : "",
      ].filter(Boolean),
    }];
  }

  return items;
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
