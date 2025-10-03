// lib/auto/confidence.ts
import { Capability, getCapability } from "./capability";

export type ConfidenceBand = "high" | "medium" | "low";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Map a numeric score into a confidence band using adapter thresholds.
 */
export function bandFor(score: number | undefined, adapterId?: string): ConfidenceBand {
  const cap: Capability = getCapability(adapterId);
  const s = typeof score === "number" ? score : 0;

  const hi = clamp01(cap.thresholdHigh ?? 0.88);
  const md = clamp01(cap.thresholdMedium ?? 0.80);

  if (s >= hi) return "high";
  if (s >= md) return "medium";
  return "low";
}

/**
 * Returns whether we should auto-send a follow-up, given adapter capabilities & band.
 * - High/Medium bands are allowed if the adapter enables autoFollowups and has capacity.
 * - Low band is never auto-followed.
 */
export function canAutoFollowup(band: ConfidenceBand, adapterId?: string): boolean {
  const cap: Capability = getCapability(adapterId);
  if (!cap.autoFollowups) return false;

  // If adapter allows followups but has no quota configured, treat as disabled.
  const hasQuota = (cap.maxFollowups ?? 0) > 0;
  if (!hasQuota) return false;

  if (band === "high") return true;
  if (band === "medium") return true;
  return false; // "low"
}
