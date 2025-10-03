/* eslint-disable @typescript-eslint/no-explicit-any */
import { Capability, getCapability } from "./capability";

export type ConfidenceBand = "high" | "medium" | "low";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

/**
 * Map a numeric score into a confidence band using adapter thresholds.
 */
export function bandFor(score: number | undefined, adapterId?: string): ConfidenceBand {
  const cap: Capability = getCapability(adapterId);
  const s = typeof score === "number" ? score : 0;

  const hi = clamp01(cap.thresholdHigh ?? 0.88);
  const md = clamp01(cap.thresholdMedium ?? 0.8);

  if (s >= hi) return "high";
  if (s >= md) return "medium";
  return "low";
}

/**
 * Returns whether we should auto-send a follow-up, given adapter capabilities & band.
 *
 * Backward-compatible call shapes:
 *   canAutoFollowup(band, adapterId?)
 *   canAutoFollowup(adapterId?, band)   <-- older callsites
 */
export function canAutoFollowup(band: ConfidenceBand, adapterId?: string): boolean;
export function canAutoFollowup(adapterId: string | undefined, band: ConfidenceBand): boolean;
export function canAutoFollowup(a: any, b?: any): boolean {
  let band: ConfidenceBand;
  let adapterId: string | undefined;

  if (typeof a === "string" && (b === "high" || b === "medium" || b === "low")) {
    // old order: (adapterId, band)
    adapterId = a;
    band = b;
  } else {
    // new order: (band, adapterId?)
    band = a as ConfidenceBand;
    adapterId = b as string | undefined;
  }

  const cap: Capability = getCapability(adapterId);
  if (!cap.autoFollowups) return false;

  const hasQuota = (cap.maxFollowups ?? 0) > 0;
  if (!hasQuota) return false;

  return band === "high" || band === "medium";
}
