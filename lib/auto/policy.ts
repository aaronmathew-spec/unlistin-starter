/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NormalizedHit } from "@/lib/scan/normalize";
import { getCapability } from "./capability";

/**
 * Input to the policy engine (server-side only)
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

/** clamp to [0,1] */
function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Cheap inference fallback; real adapter id should be added to hits by server. */
function inferAdapterFromUrl(u: string) {
  const s = (u || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}

/** Heuristic pre-check; real allowlist check happens before action creation. */
function isLikelyAllowlisted(u: string) {
  const host = (u || "").toLowerCase();
  return (
    host.includes("justdial.com") ||
    host.includes("sulekha.com") ||
    host.includes("indiamart.com")
  );
}

/** dedupe */
function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Conservative policy: is this eligible to auto-prepare?
 * Considers adapter capability, global floor, and per-state override.
 */
export function canAutoPrepare(params: {
  adapterId?: string | null;
  score?: number | null;
  state?: string | null;
  globalMinConfidence?: number;
} = {}): { ok: boolean; minApplied: number; reasons: string[] } {
  const { adapterId, score, state, globalMinConfidence } = params;

  const cap = getCapability(adapterId ?? undefined);
  const reasons: string[] = [];

  if (!cap.canAutoPrepare) {
    reasons.push("adapter:canAutoPrepare=false");
    return { ok: false, minApplied: 1, reasons };
  }

  const baseMin = clamp01(cap.defaultMinConfidence ?? 0.82);
  const floor = clamp01(globalMinConfidence ?? 0.0);
  let minApplied = Math.max(baseMin, floor);

  const st = String(state || "").toUpperCase();
  const ovMin = cap.perStateOverrides?.[st]?.minConfidence;
  if (st && ovMin != null) {
    minApplied = Math.max(minApplied, clamp01(Number(ovMin)));
  }

  const conf = clamp01(Number(score ?? 0));
  if (conf < minApplied) {
    reasons.push(`below-min:${conf.toFixed(2)}<${minApplied.toFixed(2)}`);
    return { ok: false, minApplied, reasons };
  }

  return { ok: true, minApplied, reasons };
}

/**
 * Compute the next follow-up time considering per-state override if any.
 */
export function nextFollowupAt(adapterId?: string | null, state?: string | null): string {
  const cap = getCapability(adapterId ?? undefined);
  const st = String(state || "").toUpperCase();
  const ovDays = cap.perStateOverrides?.[st]?.minConfidence; // only cadence override if you add it later
  const days = Number.isFinite(cap.followupCadenceDays)
    ? Number(cap.followupCadenceDays)
    : 4;

  const ms = Date.now() + Math.max(1, days) * 86400 * 1000;
  return new Date(ms).toISOString();
}

/**
 * Rank hits for auto-preparation. Keeps your original behavior but reuses canAutoPrepare.
 */
export function selectAutoCandidates(opts: AutoSelectOpts): AutoCandidate[] {
  const { hits, maxCount = 10, userState, globalMinConfidence = 0.82 } = opts;
  const out: AutoCandidate[] = [];

  for (const h of hits) {
    const adapterId = (h as any).adapter || inferAdapterFromUrl(h.url);
    const cap = getCapability(adapterId);
    const reasons: string[] = [];

    const okPrep = canAutoPrepare({
      adapterId,
      score: h.confidence,
      state: (h as any).state || userState || null,
      globalMinConfidence,
    });

    if (!okPrep.ok) {
      // drop below-min or adapter-disabled
      continue;
    }

    // must be allowlisted eventually
    if (!isLikelyAllowlisted(h.url)) {
      reasons.push("url-not-allowlisted");
      continue;
    }

    // avoid ambiguous “why” bullets
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
    const d = (b.hit.confidence ?? 0) - (a.hit.confidence ?? 0);
    if (d !== 0) return d;
    return order.indexOf(a.capabilityId) - order.indexOf(b.capabilityId);
  });

  return out.slice(0, maxCount);
}
