/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCapability } from "./capability";

/**
 * Confidence banding per adapter with safe defaults.
 * - "high": fire automatically
 * - "medium": fire if adapter allows auto followups
 * - "low": require human review (we won't auto-run)
 */
export type ConfidenceBand = "high" | "medium" | "low";

export function bandFor(adapterId?: string, score?: number): ConfidenceBand {
  const cap = getCapability(adapterId);
  const s = typeof score === "number" ? score : 0;
  // Base thresholds (cap overrides allow adapter tuning)
  const hi = clamp01(cap.thresholdHigh ?? 0.88);
  const md = clamp01(cap.thresholdMedium ?? 0.80);
  if (s >= hi) return "high";
  if (s >= md) return "medium";
  return "low";
}

/**
 * Returns whether we should auto-send a followup given adapter capabilities & band.
 */
export function canAutoFollowup(adapterId: string | undefined, band: ConfidenceBand): boolean {
  const cap = getCapability(adapterId);
  if (!cap.autoFollowups) return false;
  if (band === "high") return true;
  if (band === "medium") return !!cap.autoFollowupsMediumBand;
  return false;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
