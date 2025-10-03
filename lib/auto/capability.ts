/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Adapter capability model
 *
 * Keep this file self-contained:
 *  - Export the Capability type
 *  - Export a CAPABILITY_MATRIX with at least a "generic" row
 *  - Export a narrowing-safe getCapability()
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

/**
 * Global capability defaults. Other adapters can override a subset.
 * IMPORTANT: "generic" MUST exist and be a full, concrete Capability.
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

  // --- Examples (safe overrides, all optional beyond id) ---
  // Feel free to tune or add more adapters as you onboard them.
  spokeo: {
    ...thisAs("generic"),
    id: "spokeo",
    defaultMinConfidence: 0.84,
  },
  whitepages: {
    ...thisAs("generic"),
    id: "whitepages",
    attachmentsKind: "pdf",
  },
  beenverified: {
    ...thisAs("generic"),
    id: "beenverified",
    autoFollowups: true,
    followupCadenceDays: 5,
    maxFollowups: 3,
  },
  truecaller: {
    ...thisAs("generic"),
    id: "truecaller",
    canAutoSubmitEmail: false, // example: requires portal form instead of email
  },
};

/**
 * Small helper to spread the "generic" baseline in a type-safe way
 * while keeping CAPABILITY_MATRIX initializer readable above.
 */
function thisAs(key: keyof typeof CAPABILITY_MATRIX): Capability {
  // At module init time this is always present; we keep a runtime guard anyway.
  const base = CAPABILITY_MATRIX[key];
  if (!base) {
    throw new Error(`Capability base "${String(key)}" missing from CAPABILITY_MATRIX`);
  }
  return base;
}

/**
 * Narrowing-safe lookup that always returns a concrete Capability.
 * TS can’t narrow union from hasOwnProperty on an indexed access unless
 * you return from distinct branches, so we do exactly that.
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId ?? "generic").toLowerCase();

  // Ensure generic exists (defensive)
  if (!Object.prototype.hasOwnProperty.call(CAPABILITY_MATRIX, "generic")) {
    throw new Error('CAPABILITY_MATRIX must contain a "generic" entry');
  }

  // Fast path with proper narrowing
  if (Object.prototype.hasOwnProperty.call(CAPABILITY_MATRIX, a)) {
    return (CAPABILITY_MATRIX as Record<string, Capability>)[a];
  }

  // Fallback to generic
  return (CAPABILITY_MATRIX as Record<string, Capability>)["generic"];
}
