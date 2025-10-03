/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Declarative capabilities & tuning knobs per adapter.
 * All fields are optional and have sane defaults via the "generic" entry.
 */
export type Capability = {
  id: string;
  name: string;

  // Submission surface
  supportsForm?: boolean; // adapter has a web form we can re-submit
  attachmentsDefaultKind?: string; // default attachment kind for drafts/followups
  canAutoSubmitEmail?: boolean; // allow auto email submission from /api/actions/submit

  // Automation & follow-ups
  autoFollowups?: boolean; // allow auto follow-ups at all
  autoFollowupsMediumBand?: boolean; // also allow for "medium" confidence band
  maxFollowups?: number; // cap number of follow-ups (per action)
  followupStepHours?: number; // backoff step in hours (linear backoff)
  followupCadenceDays?: number; // days between scheduled followups (queue-based)

  // Confidence tuning (used by lib/auto/confidence.ts and submit flow)
  thresholdHigh?: number;   // scores >= thresholdHigh => "high"
  thresholdMedium?: number; // scores >= thresholdMedium => "medium"
  defaultMinConfidence?: number; // hard floor for auto-submission in /api/actions/submit
};

const DEFAULT_CAPABILITY: Capability = {
  id: "generic",
  name: "Generic Directory",
  supportsForm: false,
  attachmentsDefaultKind: "screenshot",
  canAutoSubmitEmail: true,
  autoFollowups: true,
  autoFollowupsMediumBand: false,
  maxFollowups: 2,
  followupStepHours: 72,
  followupCadenceDays: 7,
  thresholdHigh: 0.88,
  thresholdMedium: 0.8,
  defaultMinConfidence: 0.82,
};

export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: DEFAULT_CAPABILITY,

  // Example adapter tuning — adjust as needed as we learn
  indiamart: {
    id: "indiamart",
    name: "IndiaMART",
    supportsForm: true,
    attachmentsDefaultKind: "screenshot",
    canAutoSubmitEmail: true,
    autoFollowups: true,
    autoFollowupsMediumBand: true,
    maxFollowups: 3,
    followupStepHours: 72,
    followupCadenceDays: 6,
    thresholdHigh: 0.9,
    thresholdMedium: 0.82,
    defaultMinConfidence: 0.84,
  },

  justdial: {
    id: "justdial",
    name: "Justdial",
    supportsForm: true,
    attachmentsDefaultKind: "screenshot",
    canAutoSubmitEmail: true,
    autoFollowups: true,
    autoFollowupsMediumBand: false,
    maxFollowups: 2,
    followupStepHours: 96,
    followupCadenceDays: 7,
    thresholdHigh: 0.89,
    thresholdMedium: 0.81,
    defaultMinConfidence: 0.83,
  },
};

/**
 * Never returns undefined; always falls back to "generic".
 * Uses an "in" guard and explicit constant fallback to satisfy TS.
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId || "generic").toLowerCase();

  // Fast path: exact hit in matrix
  if (a in CAPABILITY_MATRIX) {
    return (CAPABILITY_MATRIX as Record<string, Capability>)[a];
  }

  // Fallback: generic default (constant, not optional)
  return DEFAULT_CAPABILITY;
}
