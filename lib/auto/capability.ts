// lib/auto/capability.ts

export type Capability = {
  id: string;

  // Auto-prepare & auto-send
  canAutoPrepare: boolean;
  canAutoSubmitEmail: boolean;

  // Confidence thresholds
  defaultMinConfidence: number;
  thresholdHigh: number;
  thresholdMedium: number;

  // Draft defaults
  attachmentsKind: string;

  // Follow-ups
  autoFollowups?: boolean;
  followupCadenceDays?: number;
  maxFollowups?: number;

  /**
   * Optional per-state overrides (e.g., different confidence floors,
   * temporary allow/deny, etc.). Keys should be UPPERCASE state codes,
   * since policy.ts uppercases before lookup.
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
  thresholdMedium: 0.80,
  attachmentsKind: "screenshot",
  autoFollowups: true,
  followupCadenceDays: 7,
  maxFollowups: 2,
  perStateOverrides: {}, // present so access is always safe
};

/**
 * Central registry of adapter capabilities.
 * Add or override adapters here.
 */
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: GENERIC_CAP,

  whitepages: {
    ...GENERIC_CAP,
    id: "whitepages",
  },

  truecaller: {
    ...GENERIC_CAP,
    id: "truecaller",
    canAutoSubmitEmail: false, // example: might require portal flow
  },

  beenverified: {
    ...GENERIC_CAP,
    id: "beenverified",
    autoFollowups: true,
    followupCadenceDays: 5,
    maxFollowups: 3,
    // Example of a stricter state-specific override:
    perStateOverrides: {
      IN_MH: { minConfidence: 0.86 },
    },
  },

  // Add more:
  // spokeo: { ...GENERIC_CAP, id: "spokeo" },
  // pipl:   { ...GENERIC_CAP, id: "pipl", canAutoSubmitEmail: false },
};

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Narrowing-safe lookup that ALWAYS returns a concrete Capability.
 * Falls back to GENERIC_CAP even if the matrix were somehow mutated.
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId ?? "generic").toLowerCase();

  // Guaranteed concrete fallback without unsafe assertions
  const generic =
    (CAPABILITY_MATRIX as Record<string, Capability | undefined>).generic ?? GENERIC_CAP;

  if (hasOwn(CAPABILITY_MATRIX, a)) {
    const entry = (CAPABILITY_MATRIX as Record<string, Capability | undefined>)[a];
    return entry ?? generic;
  }

  return generic;
}
