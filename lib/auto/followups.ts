// lib/auto/followups.ts
import { getCapability, type Capability } from "./capability";
import { bandFor, canAutoFollowup, type ConfidenceBand } from "./confidence";

/**
 * Return the maximum number of followups an adapter allows.
 * Falls back to 0 if unspecified.
 */
export function maxFollowups(adapterId?: string): number {
  const cap = getCapability(adapterId);
  return Number.isFinite(cap.maxFollowups) ? (cap.maxFollowups as number) : 0;
}

/**
 * Return the cadence (in days) for followups for a given adapter.
 * Falls back to 7 days if unspecified.
 */
export function followupCadenceDays(adapterId?: string): number {
  const cap = getCapability(adapterId);
  return Number.isFinite(cap.followupCadenceDays)
    ? (cap.followupCadenceDays as number)
    : 7;
}

/**
 * Compute the next followup due-at timestamp (ISO string) for a given adapter
 * and the followup index `n` you’re about to send (1-based).
 *
 * If the adapter does not allow followups or `n` exceeds `maxFollowups`,
 * returns `null`.
 */
export function computeFollowupDueAt(
  adapterId?: string,
  n?: number
): string | null {
  const cap = getCapability(adapterId);
  const allowed = !!cap.autoFollowups;
  const max = maxFollowups(adapterId);
  const nextIndex = typeof n === "number" && Number.isFinite(n) ? n : 1;

  if (!allowed) return null;
  if (nextIndex < 1 || nextIndex > max) return null;

  const days = followupCadenceDays(adapterId);
  const when = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return when.toISOString();
}

/**
 * Decide whether a followup may be auto-sent for a hit, based on:
 *  - adapter capability
 *  - confidence band (derived from numeric confidence)
 *
 * Returns an allow flag with an explanation reason and the resolved band.
 */
export function allowFollowup(
  confidence: number,
  adapterId?: string
): { allow: boolean; band: ConfidenceBand; reason: string } {
  const cap = getCapability(adapterId);
  const band = bandFor(confidence, adapterId);

  if (!cap.autoFollowups) {
    return { allow: false, band, reason: "adapter-disabled" };
  }

  const ok = canAutoFollowup(adapterId, band);
  return {
    allow: ok,
    band,
    reason: ok ? "policy-allowed" : "band-blocked",
  };
}

/**
 * Lightweight redacted-draft sanitizer used by followup scheduling.
 * Keeps body/subject length boundaries and strips obviously unsafe content.
 * NOTE: This does NOT de-redact anything—only trims and normalizes.
 */
export function sanitizeRedactedDraft(draft: {
  subject?: string | null;
  body?: string | null;
}) {
  const subj = (draft.subject ?? "").toString().slice(0, 140);
  const body = (draft.body ?? "").toString().slice(0, 1800);

  // extremely conservative scrub for accidental secrets (defense-in-depth)
  const scrub = (s: string) =>
    s
      // keep redactions as-is but neutralize long digit runs
      .replace(/\d{6,}/g, "•".repeat(6))
      // neutralize typical tokens
      .replace(/(api|bearer|token|secret|key)=?[a-z0-9-_]{10,}/gi, "[redacted]")
      // collapse control characters
      .replace(/[\u0000-\u001f]+/g, " ")
      .trim();

  return {
    subject: scrub(subj),
    body: scrub(body),
  };
}

/**
 * A compact summary describing *how* we will plan followups for a given adapter.
 * Useful for debugging/admin surfaces; avoid surfacing directly to end users.
 */
export function describeFollowupPlan(adapterId?: string) {
  const cap: Capability = getCapability(adapterId);
  return {
    adapter: adapterId ?? "generic",
    enabled: !!cap.autoFollowups,
    maxFollowups: maxFollowups(adapterId),
    cadenceDays: followupCadenceDays(adapterId),
    thresholds: {
      high: cap.thresholdHigh ?? 0.88,
      medium: cap.thresholdMedium ?? 0.8,
      defaultMinConfidence: cap.defaultMinConfidence ?? 0.82,
    },
  };
}

// Re-export types for convenience in callers that import from this module
export type { ConfidenceBand } from "./confidence";
