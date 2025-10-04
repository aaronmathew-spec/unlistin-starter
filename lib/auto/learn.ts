// lib/auto/learn.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Lightweight, no-throw Supabase client helper.
 */
function supa() {
  const jar = cookies?.();
  const getCookie = (() => {
    try {
      return (k: string) => jar?.get(k)?.value;
    } catch {
      return () => undefined;
    }
  })();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: getCookie } }
  );
}

/**
 * Persist an automation outcome for learning / telemetry.
 * Safe: catches and swallows errors (so the main flow never breaks).
 */
export async function recordOutcome(payload: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = supa();

    const table =
      process.env.OUTCOMES_TABLE ||
      "action_outcomes"; // change if your table name differs

    const toInsert = {
      created_at: new Date().toISOString(),
      action_id: payload?.action_id ?? null,
      broker: payload?.broker ?? null,
      state: payload?.state ?? null,
      adapter: payload?.adapter ?? null,
      resolution: payload?.resolution ?? null,
      took_ms: payload?.took_ms ?? null,
      confidence: payload?.confidence ?? null,
      reason: payload?.reason ?? null,
      meta: payload?.meta ?? null,
    };

    const { error } = await db.from(table).insert(toInsert);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "unexpected-error" };
  }
}

/**
 * Backward-compatible API that accepts EITHER:
 *  - a win rate NUMBER (0..1), OR
 *  - an array of samples [{ confidence:number, resolution:string }, ...]
 *
 * Returns a DELTA (positive bump to the min-confidence floor), not an absolute floor.
 * So calling code can do: `bump > 0 ? \`+${bump.toFixed(2)}\` : bump.toFixed(2)`
 */
export function suggestMinConfidenceBump(
  arg: number | any[],
  currentFloor: number = 0.82,
  targetPassRate: number = 0.9
): number {
  // If called with a number, treat it as "current pass-rate"
  if (typeof arg === "number") {
    const pass = clamp01(arg);
    const target = clamp01(targetPassRate);
    // already at/above target -> no bump
    if (pass >= target) return 0;

    // Heuristic: propose a small bump proportional to deficit.
    // deficit 0.10 -> ~0.03 bump, deficit 0.20 -> ~0.05 bump, cap at 0.15
    const deficit = target - pass;
    const bump = Math.min(0.15, round2(deficit * 0.25 + 0.005));
    return bump;
  }

  // Otherwise assume it's a samples array and do the more precise search.
  const { suggested } = suggestMinConfidenceDetails(arg, currentFloor, targetPassRate);
  if (suggested == null) return 0;
  return round2(suggested - clamp01(currentFloor));
}

/**
 * Optional detailed variant — returns the absolute suggested floor plus context.
 */
export function suggestMinConfidenceDetails(
  samples: any[],
  currentFloor: number = 0.82,
  targetPassRate: number = 0.9
): { suggested: number | null; details: any } {
  const floor = clamp01(typeof currentFloor === "number" ? currentFloor : 0.82);
  const target = clamp01(typeof targetPassRate === "number" ? targetPassRate : 0.9);

  if (!Array.isArray(samples) || samples.length === 0) {
    return { suggested: null, details: { reason: "no-samples", currentFloor: floor, targetPassRate: target } };
    }

  // Normalize into { c, ok }
  const norm = samples
    .map((s) => {
      const c = typeof s?.confidence === "number" ? s.confidence : null;
      const r = String(s?.resolution || "").toLowerCase();
      const ok = r === "sent" || r === "completed" || r === "resolved";
      return c != null && isFinite(c) ? { c: clamp01(c), ok } : null;
    })
    .filter(Boolean) as Array<{ c: number; ok: boolean }>;

  if (!norm.length) {
    return { suggested: null, details: { reason: "no-usable-samples", currentFloor: floor, targetPassRate: target } };
  }

  // Try thresholds from currentFloor up to 0.99 in 0.01 steps,
  // pick the smallest that achieves the target pass-rate with >=10 samples above threshold.
  const step = 0.01;
  let best: number | null = null;

  for (let t = floor; t <= 0.99 + 1e-9; t += step) {
    const eligible = norm.filter((s) => s.c >= t);
    if (eligible.length < 10) continue; // avoid overfitting on tiny samples
    const good = eligible.filter((s) => s.ok).length;
    const pass = good / eligible.length;
    if (pass >= target) {
      best = round2(t);
      break;
    }
  }

  return {
    suggested: best,
    details: {
      currentFloor: floor,
      targetPassRate: target,
      totalSamples: norm.length,
      note:
        best == null
          ? "No threshold found to meet target pass-rate with available samples."
          : "Suggested minimum confidence to achieve target pass-rate on recent samples.",
    },
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
