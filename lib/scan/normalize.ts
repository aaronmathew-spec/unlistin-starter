// lib/scan/normalize.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ADAPTER_META, type AdapterMeta } from "./adapter-meta";

/** Input provided to the scan normalizer (transient; never persisted) */
export type ScanInput = {
  email?: string;
  name?: string;
  city?: string; // may contain city or "City, ST"
};

/** Raw hit from an adapter before normalization (server-only) */
export type RawHit = {
  url: string;
  label: string;          // human-friendly broker/source label
  domain: string;         // hostname without scheme
  kind?: string;          // "directory" | "broker" | "social" | etc.
  fields?: Record<string, any>; // adapter-specific fields (server-only)
  matched?: string[];     // raw matched field names (server-only)
  evidence?: string[];    // redacted snippets from adapter
  score?: number;         // adapter-provided base score (0..1)
  adapter?: string;       // e.g., "justdial" | "sulekha" | "indiamart"
  state?: string;         // e.g., "MH", "KA", "DL"  (if adapter can infer)
  weight?: number;        // override baseWeight if adapter wants
};

/** Normalized hit returned to callers (safe for UI; redacted) */
export type NormalizedHit = {
  broker: string;           // label
  url: string;
  kind?: string;
  confidence: number;       // 0..1
  matched: string[];        // friendly field names (no raw PII)
  why: string[];            // redacted bullets for "Why this matched"
  preview: {
    email?: string;         // redacted preview strings
    name?: string;
    city?: string;
  };
};

/** Public API: normalize + rank raw hits into UI-safe previews. */
export function normalizeHits(input: ScanInput, raw: RawHit[]): NormalizedHit[] {
  const cityToken = (input.city || "").trim();
  const cityNorm = cityToken ? normalizeCity(cityToken) : null;
  const stateFromCity = cityNorm?.state || null;

  const redactedPreview = {
    email: input.email ? redactEmail(input.email) : undefined,
    name: input.name ? redactName(input.name) : undefined,
    city: input.city ? redactCity(input.city) : undefined,
  };

  const items = raw.map((r) => {
    // Determine adapter id
    const adapterId = (r.adapter || inferAdapterId(r.domain)).toLowerCase();
    const adapterMeta = ADAPTER_META[adapterId] || ADAPTER_META.generic;

    // Determine state from the hit or from the input fallback
    const hitState = (r.state || stateFromCity || inferStateFromFields(r.fields)) ?? null;

    // Base score & weights
    const baseScore = clamp01(typeof r.score === "number" ? r.score : 0.55);
    const baseWeight = typeof r.weight === "number" ? r.weight : adapterMeta.baseWeight;

    // Region-aware signal: if city/state appears in redacted evidence or fields
    const regionBoost = computeRegionBoost({ r, cityNorm, hitState, adapterMeta });

    // Compose confidence with caps
    let confidence = baseScore * baseWeight * regionBoost;
    const cap = adapterMeta.maxAfterBoost ?? 1.0;
    confidence = Math.min(confidence, cap);
    confidence = clamp01(confidence); // ensure [0..1]

    // Friendly field names
    const matchedFriendly = Array.isArray(r.matched) ? r.matched.map(humanizeField) : [];

    // Redact evidence bullets again defensively (no raw PII)
    const safeWhy = redactEvidenceBullets(r.evidence || [], input);

    return {
      broker: r.label || r.domain,
      url: r.url,
      kind: r.kind || "directory",
      confidence,
      matched: matchedFriendly,
      why: safeWhy,
      preview: redactedPreview,
    } satisfies NormalizedHit;
  });

  // Final sort (desc)
  items.sort((a, b) => b.confidence - a.confidence);

  return items;
}

/* ----------------------------- helpers ----------------------------- */

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function inferAdapterId(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes("justdial")) return "justdial";
  if (d.includes("sulekha")) return "sulekha";
  if (d.includes("indiamart")) return "indiamart";
  return "generic";
}

function humanizeField(f: string): string {
  const k = (f || "").toLowerCase();
  if (k === "email" || k === "e") return "email";
  if (k === "name" || k === "n") return "name";
  if (k === "phone" || k === "ph") return "phone";
  if (k === "city" || k === "location") return "city";
  return f;
}

function redactEvidenceBullets(lines: string[], input: ScanInput): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    let s = `${raw}`;
    if (input.email) s = maskSubstring(s, input.email);
    if (input.name) s = maskSubstring(s, input.name);
    if (input.city) s = maskSubstring(s, input.city);
    s = maskEmails(s);
    s = maskPhones(s);
    out.push(s);
  }
  return out;
}

/** Very conservative substring masking: does case-insensitive replace with ••• */
function maskSubstring(haystack: string, needle: string): string {
  try {
    const pattern = new RegExp(escapeRegExp(needle), "ig");
    return haystack.replace(pattern, "•••");
  } catch {
    return haystack;
  }
}

function maskEmails(s: string): string {
  // crude but safe: anything like word@word.tld → •••@•••.tld
  return s.replace(
    /([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]{1,253})\.([A-Z]{2,24})/gi,
    (_, u, d, t) => `${(u as string)[0] ?? "•"}••@${(d as string)[0] ?? "•"}••.${t}`
  );
}

function maskPhones(s: string): string {
  // mask obvious 10+ digit runs
  return s.replace(/\b\d[\d\s\-()]{9,}\b/g, (m) => m.replace(/\d/g, "•"));
}

function redactEmail(raw: string): string {
  const s = raw.trim();
  const at = s.indexOf("@");
  if (at <= 0) return "•@•";
  const user = s.slice(0, at);
  const domain = s.slice(at + 1);
  const uMasked = user.length <= 2 ? user[0] + "••" : user.slice(0, 2) + "•••";
  const parts = domain.split(".");
  if (parts.length < 2) return `${uMasked}@•••`;
  const tld = parts.pop()!;
  const root = parts.pop() || "";
  const rootMasked = root ? root[0] + "•••" : "•••";
  return `${uMasked}@${rootMasked}.${tld}`;
}

function redactName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "N•";
  const first = parts[0];
  const maskedFirst = first[0] + "•";
  return parts.length > 1 ? `${maskedFirst} ${parts.slice(1).map(() => "•").join("")}` : maskedFirst;
}

function redactCity(raw: string): string {
  const s = raw.trim();
  if (!s) return "C•";
  const [city] = s.split(",").map((x) => x.trim());
  return city ? city[0] + "•" : "C•";
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------ region-aware boosts ----------------------- */

type CityNorm = { city?: string; state?: string };

function normalizeCity(s: string): CityNorm {
  const parts = s.split(",").map((x) => x.trim());
  if (parts.length === 1) {
    // try to parse trailing state code if present (e.g., "Mumbai MH")
    const m = /\b([A-Z]{2})\b/i.exec(parts[0]);
    return { city: parts[0], state: m ? m[1].toUpperCase() : undefined };
  }
  if (parts.length >= 2) {
    const state = (parts[1] || "").toUpperCase().replace(/\s+/g, "");
    const st = /^[A-Z]{2}$/.test(state) ? state : undefined;
    return { city: parts[0], state: st };
  }
  return {};
}

function inferStateFromFields(fields?: Record<string, any> | null): string | null {
  if (!fields) return null;
  // common abbreviations the adapters may place in fields
  const s = `${fields.state || fields.region || fields.st || ""}`.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(s)) return s;
  return null;
}

function computeRegionBoost(args: {
  r: RawHit;
  cityNorm: CityNorm | null;
  hitState: string | null;
  adapterMeta: AdapterMeta;
}): number {
  const { r, cityNorm, hitState, adapterMeta } = args;
  let boost = 1.0;

  // 1) City token appears in evidence → +4%
  if (cityNorm?.city && containsToken(r.evidence || [], cityNorm.city)) {
    boost *= 1.04;
  }

  // 2) State alignment from adapter or fields
  const st = (hitState || "").toUpperCase();
  if (st && adapterMeta.stateWeight && adapterMeta.stateWeight[st]) {
    boost *= adapterMeta.stateWeight[st]!;
  } else if (st) {
    // small generic state alignment boost
    boost *= 1.02;
  }

  // 3) Directory-specific mild bonus for exact domain matches we trust
  const d = r.domain.toLowerCase();
  if (d.includes("justdial.com")) boost *= 1.01;
  if (d.includes("sulekha.com")) boost *= 1.01;
  if (d.includes("indiamart.com")) boost *= 1.005;

  // keep boost within sensible bounds
  if (!Number.isFinite(boost) || boost < 0.8) boost = 0.8;
  if (boost > 1.2) boost = 1.2;
  return boost;
}

function containsToken(lines: string[], token: string): boolean {
  const t = token.toLowerCase();
  return lines.some((s) => s.toLowerCase().includes(t));
}
