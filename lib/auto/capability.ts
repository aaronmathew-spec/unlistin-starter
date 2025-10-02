// lib/auto/capability.ts
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
  // NEW: follow-up metadata & email-only autosubmit flag (phase 1)
  followupCadenceDays?: number;     // schedule next attempt after N days
  maxFollowups?: number;            // cap per action thread
  canAutoSubmitEmail?: boolean;     // safe low-risk email-only autosubmit (future toggle)
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
    followupCadenceDays: 10,
    maxFollowups: 2,
    canAutoSubmitEmail: false,
  },
  justdial: {
    id: "justdial",
    label: "Justdial",
    canAutoPrepare: true,
    canAutoSubmit: false,
    channels: ["email", "form"],
    defaultMinConfidence: 0.84,
    notes: "Submission may hit CAPTCHA; follow-up helpful.",
    perStateOverrides: { MH: { minConfidence: 0.83 }, KA: { minConfidence: 0.83 } },
    followupCadenceDays: 7,
    maxFollowups: 2,
    canAutoSubmitEmail: false,
  },
  sulekha: {
    id: "sulekha",
    label: "Sulekha",
    canAutoPrepare: true,
    canAutoSubmit: false,
    channels: ["email"],
    defaultMinConfidence: 0.83,
    followupCadenceDays: 10,
    maxFollowups: 2,
    canAutoSubmitEmail: false,
  },
  indiamart: {
    id: "indiamart",
    label: "IndiaMART",
    canAutoPrepare: true,
    canAutoSubmit: false,
    channels: ["email"],
    defaultMinConfidence: 0.85,
    requiresOtpOrLogin: true,
    followupCadenceDays: 14,
    maxFollowups: 1,
    canAutoSubmitEmail: false,
  },
};

export function getCapability(adapterId?: string): Capability {
  const a = (adapterId || "generic").toLowerCase();
  const table = CAPABILITY_MATRIX as Record<string, Capability | undefined>;
  const cap = table[a];
  return cap ?? table["generic"]!;
}
