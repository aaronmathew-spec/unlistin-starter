// lib/scan/adapter-meta.ts
/**
 * Centralized adapter metadata for ranking.
 * Adapters can optionally set `adapter`, `state`, and/or `weight` on RawHit.
 * If they don't, we fall back to this map using domain heuristics in normalize().
 */

export type AdapterMeta = {
  /** Base confidence weight applied to all hits from this adapter */
  baseWeight: number;
  /** Optional per-state boosts (e.g., "MH", "KA", "DL") */
  stateWeight?: Record<string, number>;
  /** Cap applied after all boosts for this adapter */
  maxAfterBoost?: number;
};

/** Reasonable, conservative defaults; tweak freely. */
export const ADAPTER_META: Record<string, AdapterMeta> = {
  justdial: {
    baseWeight: 1.10,
    stateWeight: { MH: 1.05, KA: 1.04, DL: 1.03, TN: 1.03, GJ: 1.03 },
    maxAfterBoost: 1.35,
  },
  sulekha: {
    baseWeight: 1.06,
    stateWeight: { TN: 1.05, KA: 1.04, MH: 1.03, DL: 1.03 },
    maxAfterBoost: 1.30,
  },
  indiamart: {
    baseWeight: 1.04,
    stateWeight: { MH: 1.04, KA: 1.03, DL: 1.03, GJ: 1.03, TN: 1.02 },
    maxAfterBoost: 1.28,
  },

  // Phase 1 expansion
  truecaller: {
    baseWeight: 1.08,
    stateWeight: { MH: 1.03, KA: 1.03, DL: 1.03, TN: 1.02, GJ: 1.02 },
    maxAfterBoost: 1.30,
  },
  naukri: {
    baseWeight: 1.05,
    stateWeight: { KA: 1.04, MH: 1.03, DL: 1.03, TN: 1.02 },
    maxAfterBoost: 1.28,
  },
  olx: {
    baseWeight: 1.03,
    stateWeight: { MH: 1.03, DL: 1.03, KA: 1.02, TN: 1.02 },
    maxAfterBoost: 1.25,
  },

  /** Fallback for unknown adapters / generic directories */
  generic: {
    baseWeight: 1.00,
    maxAfterBoost: 1.20,
  },
};
