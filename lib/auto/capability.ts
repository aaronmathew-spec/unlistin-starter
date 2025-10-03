/* eslint-disable @typescript-eslint/no-explicit-any */

export type Capability = {
  id: string;

  // Auto-prepare & auto-send
  canAutoPrepare: boolean;
  canAutoSubmitEmail: boolean;

  // Confidence thresholds
  defaultMinConfidence: number; // 0..1
  thresholdHigh: number;        // banding cutoff
  thresholdMedium: number;      // banding cutoff

  // Draft defaults
  attachmentsKind: string;

  // Follow-ups
  autoFollowups?: boolean;
  followupCadenceDays?: number;
  maxFollowups?: number;

  /**
   * Optional per-state overrides; keys should be UPPERCASE.
   */
  perStateOverrides?: Record<
    string,
    {
      minConfidence?: number;
      allow?: boolean;
      deny?: boolean;
    }
  >;
};

// Known-good generic baseline (never undefined)
const GENERIC_CAP: Capability = {
  id: "generic",
  canAutoPrepare: true,
  canAutoSubmitEmail: true,
  defaultMinConfidence: 0.82,
  thresholdHigh: 0.88,
  thresholdMedium: 0.8,
  attachmentsKind: "screenshot",
  autoFollowups: true,
  followupCadenceDays: 7,
  maxFollowups: 2,
  perStateOverrides: {},
};

/**
 * Central registry of adapter capabilities.
 * NOTE: include adapters referenced elsewhere (justdial/sulekha/indiamart).
 */
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  // baseline
  generic: GENERIC_CAP,

  // adapters used by inferAdapterFrom* in various modules
  justdial: {
    ...GENERIC_CAP,
    id: "justdial",
    defaultMinConfidence: 0.84,
    thresholdHigh: 0.9,
    thresholdMedium: 0.82,
    followupCadenceDays: 4,
    maxFollowups: 2,
  },
  sulekha: {
    ...GENERIC_CAP,
    id: "sulekha",
    defaultMinConfidence: 0.84,
    thresholdHigh: 0.9,
    thresholdMedium: 0.82,
    followupCadenceDays: 4,
    maxFollowups: 2,
  },
  indiamart: {
    ...GENERIC_CAP,
    id: "indiamart",
    defaultMinConfidence: 0.85,
    thresholdHigh: 0.9,
    thresholdMedium: 0.82,
    followupCadenceDays: 5,
    maxFollowups: 2,
  },

  // the ones you listed previously
  whitepages: {
    ...GENERIC_CAP,
    id: "whitepages",
  },
  truecaller: {
    ...GENERIC_CAP,
    id: "truecaller",
    canAutoSubmitEmail: false, // e.g., portal flow only
  },
  beenverified: {
    ...GENERIC_CAP,
    id: "beenverified",
    autoFollowups: true,
    followupCadenceDays: 5,
    maxFollowups: 3,
    perStateOverrides: {
      IN_MH: { minConfidence: 0.86 },
    },
  },
};

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Narrowing-safe lookup that ALWAYS returns a concrete Capability.
 * Falls back to GENERIC_CAP even if the matrix were mutated.
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId ?? "generic").toLowerCase().trim();

  const generic =
    (CAPABILITY_MATRIX as Record<string, Capability | undefined>).generic ?? GENERIC_CAP;

  if (hasOwn(CAPABILITY_MATRIX, a)) {
    const entry = (CAPABILITY_MATRIX as Record<string, Capability | undefined>)[a];
    return entry ?? generic;
  }
  return generic;
}
