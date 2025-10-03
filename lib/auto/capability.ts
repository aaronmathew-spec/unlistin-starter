// lib/auto/capability.ts

export type Capability = {
  /** Identifier of the adapter, lowercase (e.g., 'generic', 'truecaller'). */
  id: string;

  /** Whether drafts can be auto-prepared by the server (no user click). */
  canAutoPrepare: boolean;

  /** Whether emails can be auto-queued/sent for this adapter. */
  canAutoSubmitEmail: boolean;

  /** Default minimum confidence for this adapter when auto-preparing. */
  defaultMinConfidence: number;

  /** Confidence band thresholds used by bandFor() / policy. */
  thresholdHigh: number;
  thresholdMedium: number;

  /** Default attachment kind to request in drafts for this adapter. */
  attachmentsKind: string;

  /** Are automatic follow-ups permitted? */
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
  thresholdMedium: 0.80,
  autoFollowups: true,
  followupCadenceDays: 7, // sensible default cadence
  maxFollowups: 2,        // original send + 2 nudges
};

/**
 * Central registry of adapter capabilities.
 * Add specific adapters here to override the generic defaults.
 */
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: GENERIC_CAP,

  // Examples — tweak for your project needs:
  // Phone directory style sites (email ok, follow-ups allowed)
  whitepages: {
    ...GENERIC_CAP,
    id: "whitepages",
  },
  truecaller: {
    ...GENERIC_CAP,
    id: "truecaller",
    canAutoSubmitEmail: false, // may require portal flow instead of email
  },
  beenverified: {
    ...GENERIC_CAP,
    id: "beenverified",
    autoFollowups: true,
    followupCadenceDays: 5,
    maxFollowups: 3,
  },
  // Add more adapters as needed:
  // "pipl": { ...GENERIC_CAP, id: "pipl", canAutoSubmitEmail: false },
  // "spokeo": { ...GENERIC_CAP, id: "spokeo" },
};

/** Tiny own-property check (avoids proto chain). */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Narrowing-safe lookup that ALWAYS returns a concrete Capability.
 * Reads via a permissive index (could be undefined) and coalesces to the
 * guaranteed `generic` capability.
 */
export function getCapability(adapterId?: string): Capability {
  const a = (adapterId ?? "generic").toLowerCase();

  // Ensure CAPABILITY_MATRIX has a concrete generic we can always return.
  if (!hasOwn(CAPABILITY_MATRIX, "generic")) {
    throw new Error('CAPABILITY_MATRIX must contain a "generic" entry');
  }
  // Use direct property access so TS knows this is a Capability, not possibly undefined.
  const generic: Capability = CAPABILITY_MATRIX.generic;

  // Read with permissive index (may be undefined), then coalesce to generic.
  const entry = (CAPABILITY_MATRIX as Record<string, Capability | undefined>)[a];
  return entry ?? generic;
}
