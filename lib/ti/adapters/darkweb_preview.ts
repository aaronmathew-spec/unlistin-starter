/**
 * Threat Intel (stub): dark web / leak "previews".
 * v1 does NOT fetch. It synthesizes deterministic, allowlisted URLs
 * that the UI can show as hints. No PII is persisted.
 */
import { isAllowed } from "@/lib/scan/domains-allowlist";

export type DarkPreviewInput = {
  email?: string;
  phone?: string;
  username?: string;
};

export type DarkPreviewHit = {
  source: string; // label
  domain: string;
  url: string;    // allowlisted preview (never fetched)
  risk: "low" | "medium" | "high";
  note?: string;
};

const SOURCES = [
  { domain: "haveibeenpwned.com", label: "Have I Been Pwned", risk: "medium" as const },
  { domain: "intelx.io",          label: "Intelligence X",   risk: "medium" as const },
  { domain: "leakcheck.io",       label: "LeakCheck",        risk: "high"   as const },
  { domain: "dehashed.com",       label: "Dehashed",         risk: "high"   as const },
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function darkwebPreview(input: DarkPreviewInput): Promise<DarkPreviewHit[]> {
  const seed = (input.email || input.phone || input.username || "").toLowerCase().trim();
  if (!seed) return [];

  const h = hashSeed(seed);
  const picks = new Set<number>();
  for (let i = 0; picks.size < 3 && i < SOURCES.length * 2; i++) {
    picks.add((h + i * 97) % SOURCES.length);
  }

  const out: DarkPreviewHit[] = [];
  for (const idx of picks) {
    const src = SOURCES[idx]!;
    // synthesize a benign, public landing URL with query param; never fetched here
    const url = `https://${src.domain}/?q=${encodeURIComponent(seed)}&ref=unlistin-ti`;
    if (!isAllowed(url)) continue; // reuse global allowlist discipline
    out.push({
      source: src.label,
      domain: src.domain,
      url,
      risk: src.risk,
      note: `Potential exposure indicator for “${seed}” on ${src.label}.`,
    });
  }
  return out;
}
