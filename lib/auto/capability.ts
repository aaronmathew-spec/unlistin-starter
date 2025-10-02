/* eslint-disable @typescript-eslint/no-explicit-any */
export type Capability = {
  id: string;                       // adapter id (matches normalize.ts inference)
  label: string;                    // human label
  canAutoPrepare: boolean;          // we can auto-generate drafts safely
  canAutoSubmit: boolean;           // future: we can auto-submit without human confirm
  channels: Array<"email" | "portal" | "form">;
  requiresOtpOrLogin?: boolean;     // if true, we must escalate at submit-time
  defaultMinConfidence?: number;    // adapter-specific floor for selection
  notes?: string;
  perStateOverrides?: Record<string, { minConfidence?: number }>;
};

// Seed a conservative capability matrix (extend as we learn)
export const CAPABILITY_MATRIX: Record<string, Capability> = {
  generic: {
    id: "generic",
    label: "Generic Directory",
    canAutoPrepare: true,
    canAutoSubmit: false,
    channels: ["email"],
    defaultMinConfidence: 0.82,
    notes: "Conservative defaults; falls back to Concierge if unsure.",
  },
  justdial: {
    id: "justdial",
    label: "Justdial",
    canAutoPrepare: true,
    canAutoSubmit: false,
    channels: ["email", "form"],
    defaultMinConfidence: 0.84,
    notes: "Stable evidence; submission may encounter CAPTCHA → Concierge at submit-time.",
    perStateOverrides: {
      MH: { minConfidence: 0.83 },
      KA: { minConfidence: 0.83 },
    },
  },
  sulekha: {
    id: "sulekha",
    label: "Sulekha",
    canAutoPrepare: true,
    canAutoSubmit: false,
    channels: ["email"],
    defaultMinConfidence: 0.83,
  },
  indiamart: {
    id: "indiamart",
    label: "IndiaMART",
    canAutoPrepare: true,
    canAutoSubmit: false,
    channels: ["email"],
    defaultMinConfidence: 0.85,
    requiresOtpOrLogin: true,
  },
};

export function getCapability(adapterId?: string): Capability {
  const a = (adapterId || "generic").toLowerCase();
  return CAPABILITY_MATRIX[a] || CAPABILITY_MATRIX.generic;
}
