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
  id: string;

  /** Auto-create prepared actions (no user click)? */
  canAutoPrepare: boolean;

  /** Auto-submit emails without showing a draft? */
  canAutoSubmitEmail: boolean;

  /** Preferred evidence type if any. */
  attachmentsKind?: "screenshot" | "pdf" | "image" | "txt" | string;

  /** Default min confidence for auto flows (when no admin override). */
  defaultMinConfidence?: number;

  /** Confidence band thresholds used elsewhere. */
  thresholdHigh?: number;
  thresholdMedium?: number;

  /** Automatic follow-ups permitted? */
  autoFollowups?: boolean;

  /** Days between follow-ups. */
  followupCadenceDays?: number;

  /** Max # of follow-ups (not counting original send). */
  maxFollowups?: number;
};

/** Concrete base capability — no self-references. */
const GENERIC_CAP: Capability = {
  id: "generic",
  canAutoPrepare: true,
  canAutoSubmitEmail: true,
  attachmentsKind: "screenshot",
  defaultMinConfidence: 0.82,
  thresholdHigh: 0.88,
  thresholdMedium: 0.8,
  autoFollowups: true,
  followupCadenceDays: 7,
  maxFollowups: 2,
};

/** Global capability map. MUST include "generic". */
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: GENERIC_CAP,

  // Example adapters — customize as needed:
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
    canAutoSubmitEmail: false, // e.g., portal flow
  },
};

/** Type guard on own properties (no proto). */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Narrowing-safe lookup that ALWAYS returns a concrete Capability.
 * Uses a permissive index read and a guaranteed `generic` fallback.
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId ?? "generic").toLowerCase();

  // Ensure generic exists and capture as a concrete Capability
  if (!hasOwn(CAPABILITY_MATRIX, "generic")) {
    throw new Error('CAPABILITY_MATRIX must contain a "generic" entry');
  }
  const generic: Capability = (CAPABILITY_MATRIX as Record<string, Capability>)["generic"];

  // Read with a permissive index (could be undefined) then coalesce.
  const entry = (CAPABILITY_MATRIX as Record<string, Capability | undefined>)[a];
  return entry ?? generic;
}
