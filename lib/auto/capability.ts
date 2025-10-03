// lib/auto/capability.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Capability = {
  /** adapter id key (lowercase) */
  id: string;

  /** allow creating prepared actions automatically for this adapter */
  canAutoPrepare: boolean;

  /** allow auto-submitting via email channel (queueing outbox) */
  canAutoSubmitEmail: boolean;

  /** default attachment kind the adapter expects ("screenshot", "pdf", etc.) */
  attachmentsKind?: string;

  /** global minimum confidence to consider a hit eligible for auto actions */
  defaultMinConfidence?: number;

  /** band thresholds used by confidence helpers */
  thresholdHigh?: number;   // e.g., 0.88
  thresholdMedium?: number; // e.g., 0.80

  /** follow-up behavior */
  autoFollowups?: boolean;      // allow auto followups at all
  followupCadenceDays?: number; // days between followups
  maxFollowups?: number;        // maximum number of followups to schedule
};

/**
 * Central capability matrix. Add adapter-specific overrides here.
 * Keys MUST be lowercase.
 */
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: {
    id: "generic",
    canAutoPrepare: true,
    canAutoSubmitEmail: true,
    attachmentsKind: "screenshot",
    defaultMinConfidence: 0.82,
    thresholdHigh: 0.88,
    thresholdMedium: 0.80,
    autoFollowups: true,
    followupCadenceDays: 7,
    maxFollowups: 2,
  },

  // Examples you can tailor as needed:
  // "whitepages": {
  //   id: "whitepages",
  //   canAutoPrepare: true,
  //   canAutoSubmitEmail: true,
  //   attachmentsKind: "screenshot",
  //   defaultMinConfidence: 0.85,
  //   thresholdHigh: 0.90,
  //   thresholdMedium: 0.82,
  //   autoFollowups: true,
  //   followupCadenceDays: 7,
  //   maxFollowups: 2,
  // },
  // "truecaller": {
  //   id: "truecaller",
  //   canAutoPrepare: true,
  //   canAutoSubmitEmail: false, // form-based; no auto email
  //   attachmentsKind: "screenshot",
  //   defaultMinConfidence: 0.84,
  //   thresholdHigh: 0.89,
  //   thresholdMedium: 0.81,
  //   autoFollowups: true,
  //   followupCadenceDays: 10,
  //   maxFollowups: 1,
  // },
};

/**
 * Get a capability object for an adapter id with a safe generic fallback.
 * Always returns a Capability (never undefined).
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId ?? "generic").toLowerCase();
  const table = CAPABILITY_MATRIX as Record<string, Capability>;
  return Object.prototype.hasOwnProperty.call(table, a) ? table[a] : table["generic"];
}
