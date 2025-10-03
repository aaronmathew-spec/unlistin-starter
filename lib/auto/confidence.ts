// lib/auto/capability.ts

export type Capability = {
  // orchestration flags
  canAutoPrepare: boolean;         // <— needed by lib/auto/policy.ts
  canAutoSubmitEmail: boolean;     // <— used by actions/submit route
  autoFollowups: boolean;          // <— used by confidence/followups logic

  // followup tuning
  followupCadenceDays?: number;    // days between followups
  maxFollowups?: number;           // how many followups to schedule

  // content / attachment defaults
  attachmentsKind?: string;        // e.g. "screenshot"

  // confidence thresholds / gates
  thresholdHigh?: number;          // e.g. 0.88
  thresholdMedium?: number;        // e.g. 0.80
  defaultMinConfidence?: number;   // e.g. 0.82
};

// Adapter capabilities (override generic as needed)
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: {
    canAutoPrepare: true,
    canAutoSubmitEmail: false, // default: prep only, no auto-send
    autoFollowups: true,
    followupCadenceDays: 14,
    maxFollowups: 2,
    attachmentsKind: "screenshot",
    thresholdHigh: 0.88,
    thresholdMedium: 0.80,
    defaultMinConfidence: 0.82,
  },

  // examples — adjust to your adapters
  // "indiamart": { ...CAPABILITY_MATRIX.generic, canAutoSubmitEmail: true },
  // "justdial":  { ...CAPABILITY_MATRIX.generic, maxFollowups: 3 },
};

export function getCapability(adapterId: string | undefined): Capability {
  const a = (adapterId ?? "generic").toLowerCase();
  const table = CAPABILITY_MATRIX as Record<string, Capability>;
  return Object.prototype.hasOwnProperty.call(table, a) ? table[a] : table["generic"];
}
