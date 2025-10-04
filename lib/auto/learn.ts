// lib/auto/learn.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Lightweight, no-throw Supabase client helper.
 */
function supa() {
  const jar = cookies?.();
  // In non-request contexts cookies() can throw; guard it.
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
 * Totally safe: catches and swallows errors (so the main flow never breaks).
 *
 * Example payload (fields are flexible):
 * {
 *   action_id: number,
 *   broker: string,
 *   state?: string|null,
 *   adapter?: string|null,
 *   resolution: "sent" | "prepared" | "skipped" | "failed" | string,
 *   took_ms?: number | null,
 *   confidence?: number | null,
 *   reason?: string | null,
 * }
 */
export async function recordOutcome(payload: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = supa();

    // Prefer an existing table if you already created one; otherwise this will
    // just fail silently (we swallow errors below).
    // You can rename this to match your schema ("outcomes" / "action_outcomes" / etc.)
    const table =
      process.env.OUTCOMES_TABLE ||
      "action_outcomes"; // change here if your table name differs

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
    if (error) {
      // swallow but report "ok: false" so callers may log if desired
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    // absolutely do not throw from learning paths
    return { ok: false, error: e?.message || "unexpected-error" };
  }
}

/**
 * Heuristic: suggest raising the min-confidence floor so that the share of
 * "good" outcomes (e.g., resolution === "sent" or "completed") among hits
 * above that floor is at least `targetPassRate`.
 *
 * Flexible signature so your admin page can call it however it likes:
 *   - suggestMinConfidenceBump(samples)
 *   - suggestMinConfidenceBump(samples, currentFloor)
 *   - suggestMinConfidenceBump(samples, currentFloor, targetPassRate)
 *
 * Where `samples` can be:
 *   Array<{ confidence?: number|null, resolution?: string|null }>
 *
 * Returns:
 *   { suggested: number|null, details: any }
 */
export function suggestMinConfidenceBump(
  ...args: any[]
): { suggested: number | null; details: any } {
  const samples = Array.isArray(args[0]) ? (args[0] as any[]) : [];
  const currentFloor =
    typeof args[1] === "number" && isFinite(args[1]) ? Math.max(0, Math.min(1, args[1])) : 0.82;
  const targetPassRate =
    typeof args[2] === "number" && isFinite(args[2]) ? Math.max(0.5, Math.min(0.99, args[2])) : 0.9;

  if (!samples.length) {
    return { suggested: null, details: { reason: "no-samples", currentFloor, targetPassRate } };
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
    return { suggested: null, details: { reason: "no-usable-samples", currentFloor, targetPassRate } };
  }

  // Try thresholds from currentFloor up to 0.99 in small steps,
  // pick the smallest that achieves the target pass-rate.
  const step = 0.01;
  let best: number | null = null;

  for (let t = Math.max(0, Math.min(1, currentFloor)); t <= 0.99 + 1e-9; t += step) {
    const eligible = norm.filter((s) => s.c >= t);
    if (eligible.length < 10) {
      // avoid overfitting on tiny samples
      continue;
    }
    const good = eligible.filter((s) => s.ok).length;
    const pass = good / eligible.length;

    if (pass >= targetPassRate) {
      best = round2(t);
      break;
    }
  }

  return {
    suggested: best,
    details: {
      currentFloor,
      targetPassRate,
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
