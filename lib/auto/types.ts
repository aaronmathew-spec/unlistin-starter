/* eslint-disable @typescript-eslint/no-explicit-any */

export type ConfidenceBand = "low" | "med" | "high";

/**
 * Adapter capability surface.
 * Keep fields optional; callers should always use defaults.
 */
export type Capability = {
  /** adapter id (lowercase key) */
  id: string;

  /** can we auto-submit an email for this adapter? */
  canAutoSubmitEmail?: boolean;

  /** can we auto-prepare a follow-up (copy prior redacted draft)? */
  canAutoPrepare?: boolean;

  /** allow auto follow-ups at all */
  autoFollowups?: boolean;

  /**
   * policy knobs
   */
  defaultMinConfidence?: number; // 0..1 default threshold
  followupCadenceDays?: number;  // days between nudges
  maxFollowups?: number;         // total follow-ups after the first send

  /**
   * optional per-state overrides (e.g., US states); keys should be UPPERCASE
   */
  perStateOverrides?: Record<
    string,
    {
      minConfidence?: number;        // 0..1
      followupCadenceDays?: number;  // override cadence
      maxFollowups?: number;         // override cap
    }
  >;

  /** bag for future toggles */
  meta?: Record<string, any>;
};
