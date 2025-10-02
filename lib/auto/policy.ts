/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NormalizedHit } from "@/lib/scan/normalize";
import { getCapability } from "./capability";

/**
 * Input to the policy engine (server-side only)
 * - hits: normalized, redacted results
 * - maxCount: cap per run
 * - userState: optional ISO state code (e.g., "MH") derived from user consented Deep Scan
 * - globalMinConfidence: global floor; adapter can override upward
 */
export type AutoSelectOpts = {
  hits: Array<NormalizedHit & { adapter?: string; state?: string }>;
  maxCount?: number;
  userState?: string | null;
  globalMinConfidence?: number; // default 0.82
};

export type AutoCandidate = {
  hit: NormalizedHit & { adapter?: string; state?: string };
  reason: string[];
  capabilityId: string;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function selectAutoCandidates(opts: AutoSelectOpts): AutoCandidate[] {
  const { hits, maxCount = 10, userState, globalMinConfidence = 0.82 } = opts;
  const out: AutoCandidate[] = [];

  for (const h of hits) {
    const adapterId = (h as any).adapter || inferAdapterFromUrl(h.url);
    const cap = getCapability(adapterId);
    const reasons: string[] = [];

    if (!cap.canAutoPrepare) continue;

    const conf = clamp01(h.confidence);
    const st = ((h as any).state || userState || "").toUpperCase();

    // compute min confidence
    const baseMin = Math.max(globalMinConfidence, cap.defaultMinConfidence ?? 0);
    const overrideMin =
      (st && cap.perStateOverrides && cap.perStateOverrides[st]?.minConfidence) || baseMin;

    if (conf < overrideMin) {
      reasons.push(`below-min-confidence:${conf.toFixed(2)}<${overrideMin.toFixed(2)}`);
      continue;
    }

    // must have allowlisted URL by the time we act (actual check happens downstream)
    if (!isLikelyAllowlisted(h.url)) {
      reasons.push("url-not-allowlisted");
      continue;
    }

    // avoid ambiguous “why” bullets suggesting mismatch (defensive)
    const dangerTerms = ["different city", "not your", "mismatch", "possible duplicate"];
    const why = (h.why || []).join(" ").toLowerCase();
    if (dangerTerms.some((t) => why.includes(t))) {
      reasons.push("ambiguous-why");
      continue;
    }

    out.push({
      hit: h,
      reason: uniq(["confidence-ok", "adapter-capable"].concat(reasons)),
      capabilityId: cap.id,
    });
  }

  // prefer higher confidence, then adapter priority (justdial>sulekha>indiamart>generic)
  const order = ["justdial", "sulekha", "indiamart", "generic"];
  out.sort((a, b) => {
    const d = b.hit.confidence - a.hit.confidence;
    if (d !== 0) return d;
    return order.indexOf(a.capabilityId) - order.indexOf(b.capabilityId);
  });

  return out.slice(0, maxCount);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// Cheap inference fallback; real adapter id should be added to hits by server.
function inferAdapterFromUrl(u: string) {
  const s = (u || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}

// Heuristic pre-check; the real allowlist check happens before action creation.
function isLikelyAllowlisted(u: string) {
  const host = (u || "").toLowerCase();
  return host.includes("justdial.com") || host.includes("sulekha.com") || host.includes("indiamart.com");
}
