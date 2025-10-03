/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Adapter capability model
 *
 * Exports:
 *  - Capability (type)
 *  - CAPABILITY_MATRIX (record with at least "generic")
 *  - getCapability(adapterId?) => Capability (never undefined)
 */

export type Capability = {
  /** Stable id of the adapter (e.g., "generic", "spokeo"). */
  id: string;

  /** Can we auto-create prepared actions (no user click)? */
  canAutoPrepare: boolean;

  /** Can we auto-submit emails without showing a draft to the user? */
  canAutoSubmitEmail: boolean;

  /** If the adapter prefers a specific evidence attachment kind (e.g., "screenshot"). */
  attachmentsKind?: "screenshot" | "pdf" | "image" | "txt" | string;

  /**
   * Default minimum confidence threshold for auto workflows when no per-adapter
   * admin override is present. Used by actions/submit and policy selection.
   */
  defaultMinConfidence?: number; // e.g., 0.82

  /** Confidence band thresholds used by lib/auto/confidence.ts */
  thresholdHigh?: number;   // e.g., 0.88
  thresholdMedium?: number; // e.g., 0.80

  /** Whether we allow automatic follow-ups for this adapter. */
  autoFollowups?: boolean;

  /** Days between automatic follow-ups when enabled. */
  followupCadenceDays?: number;

  /** Max count of follow-ups to enqueue (not counting the original send). */
  maxFollowups?: number;
};

/** Concrete, reusable base so we don’t reference CAPABILITY_MATRIX during init. */
const GENERIC_CAP: Capability = {
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
};

/**
 * Global capability map. "generic" MUST exist and be a full, concrete Capability.
 * Add/override per adapter below (only differences from generic are needed).
 */
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: GENERIC_CAP,

  // Examples — tune to your needs:
  spokeo: {
    ...GENERIC_CAP,
    id: "spokeo",
    defaultMinConfidence: 0.84,
  },
  whitepages: {
    ...GENERIC_CAP,
    id: "whitepages",
    attachmentsKind: "pdf",
  },
  beenverified: {
    ...GENERIC_CAP,
    id: "beenverified",
    autoFollowups: true,
    followupCadenceDays: 5,
    maxFollowups: 3,
  },
  truecaller: {
    ...GENERIC_CAP,
    id: "truecaller",
    canAutoSubmitEmail: false, // example: requires portal form instead of email
  },
};

/** Type guard so TS narrows keys safely when reading CAPABILITY_MATRIX. */
function hasCapKey(k: string): k is keyof typeof CAPABILITY_MATRIX {
  return Object.prototype.hasOwnProperty.call(CAPABILITY_MATRIX, k);
}

/**
 * Narrowing-safe lookup that always returns a concrete Capability.
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId ?? "generic").toLowerCase();

  // Defensive: ensure generic exists
  if (!hasCapKey("generic")) {
    throw new Error('CAPABILITY_MATRIX must contain a "generic" entry');
  }

  return hasCapKey(a) ? CAPABILITY_MATRIX[a] : CAPABILITY_MATRIX["generic"];
}
