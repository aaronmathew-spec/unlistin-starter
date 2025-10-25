// src/lib/sla/policy.ts
// Central SLA knobs for reminders & escalations. Keep conservative defaults.
// All durations in hours for simple math.

export const runtime = "nodejs";

export type SlaStandard = {
  /** Target acknowledgement window for standard requests */
  ackHours: number;          // e.g., 48h acknowledge
  /** When to send first reminder if not resolved */
  firstReminderHours: number; // e.g., 168h (7d)
  /** When to send second reminder */
  secondReminderHours: number; // e.g., 336h (14d)
};

export type SlaIntimateFastLane = {
  /** Acknowledge within 24h (IT Rules) */
  ackHours: number;
  /** Escalation window for non-compliance */
  escalateHours: number; // e.g., 72h-96h window to push escalation copy
};

export const SLA: {
  standard: SlaStandard;
  intimateFastLane: SlaIntimateFastLane;
} = {
  standard: {
    ackHours: 48,
    firstReminderHours: 168,   // 7 days
    secondReminderHours: 336,  // 14 days
  },
  intimateFastLane: {
    ackHours: 24,
    escalateHours: 96,         // 4 days
  },
};
