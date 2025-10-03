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

  // Automation & follow-ups
  autoFollowups?: boolean; // allow auto follow-ups at all
  autoFollowupsMediumBand?: boolean; // also allow for "medium" confidence band
  maxFollowups?: number; // cap number of follow-ups (per action)
  followupStepHours?: number; // backoff step in hours (linear backoff)
  followupCadenceDays?: number; // days between scheduled followups (queue-based)

  // Confidence tuning (used by lib/auto/confidence.ts)
  thresholdHigh?: number;   // scores >= thresholdHigh => "high"
  thresholdMedium?: number; // scores >= thresholdMedium => "medium"
};

export const CAPABILITY_MATRIX: Record<string, Capability> = {
  // Safe fallback for unknown adapters
  generic: {
    id: "generic",
    name: "Generic Directory",
    supportsForm: false,
    attachmentsDefaultKind: "screenshot",
    autoFollowups: true,
    autoFollowupsMediumBand: false,
    maxFollowups: 2,
    followupStepHours: 72, // 72h, 144h…
    followupCadenceDays: 7,
    thresholdHigh: 0.88,
    thresholdMedium: 0.8,
  },

  // Example adapter tuning — adjust as needed as we learn
  indiamart: {
    id: "indiamart",
    name: "IndiaMART",
    supportsForm: true,
    attachmentsDefaultKind: "screenshot",
    autoFollowups: true,
    autoFollowupsMediumBand: true,
    maxFollowups: 3,
    followupStepHours: 72,
    followupCadenceDays: 6,
    thresholdHigh: 0.9,
    thresholdMedium: 0.82,
  },

  justdial: {
    id: "justdial",
    name: "Justdial",
    supportsForm: true,
    attachmentsDefaultKind: "screenshot",
    autoFollowups: true,
    autoFollowupsMediumBand: false,
    maxFollowups: 2,
    followupStepHours: 96,
    followupCadenceDays: 7,
    thresholdHigh: 0.89,
    thresholdMedium: 0.81,
  },
};

/**
 * Never returns undefined; always falls back to "generic".
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId || "generic").toLowerCase();
  const table = CAPABILITY_MATRIX as Record<string, Capability>;
  if (Object.prototype.hasOwnProperty.call(table, a)) return table[a];
  return table["generic"];
}
