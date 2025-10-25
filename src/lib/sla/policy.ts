// src/lib/sla/policy.ts
export const SLA = {
  standard: { ackDays: 7, resolveDays: 15 },
  dpdpHeuristic: { ackDays: 7, resolveDays: 30 },
  intimateFastLane: { ackHours: 24 }, // IT Rules, 2021
} as const;
