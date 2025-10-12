// src/lib/confidence.ts
export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function scoreBySignals(signals: {
  phoneMatch?: boolean;
  emailMatch?: boolean;
  namePresent?: boolean;
  controllerTier?: number; // 1 (high) .. 3 (low)
}) {
  let s = 0;
  if (signals.phoneMatch) s += 0.5;
  if (signals.emailMatch) s += 0.4;
  if (signals.namePresent) s += 0.1;

  // Slight nudge by tier (Tier 1 providers are more reliable)
  if (signals.controllerTier === 1) s += 0.05;
  if (signals.controllerTier === 3) s -= 0.05;

  return clamp01(s);
}
