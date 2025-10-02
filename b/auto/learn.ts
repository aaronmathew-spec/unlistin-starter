// lib/auto/learn.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type OutcomeEvent = {
  action_id: number;
  broker: string;
  state?: string | null;
  adapter?: string | null;
  resolution: "removed" | "failed" | "sent" | "prepared";
  took_ms?: number | null; // optional latency metric
};

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * Upserts non-PII adapter stats by (adapter_id, state).
 * This is append-only style: we keep counters & basic aggregates.
 */
export async function recordOutcome(ev: OutcomeEvent) {
  const adapter_id = (ev.adapter || inferAdapterFromBrokerOrUrl(ev.broker)).toLowerCase();
  const st = (ev.state || "").toUpperCase() || null;

  const delta = {
    adapter_id,
    state: st,
    cnt_prepared: ev.resolution === "prepared" ? 1 : 0,
    cnt_sent: ev.resolution === "sent" ? 1 : 0,
    cnt_removed: ev.resolution === "removed" ? 1 : 0,
    cnt_failed: ev.resolution === "failed" ? 1 : 0,
    sum_ms: ev.took_ms && ev.took_ms > 0 ? ev.took_ms : 0,
  };

  const db = supa();
  await db.rpc("adapter_stats_upsert_delta", {
    p_adapter_id: delta.adapter_id,
    p_state: delta.state,
    p_cnt_prepared: delta.cnt_prepared,
    p_cnt_sent: delta.cnt_sent,
    p_cnt_removed: delta.cnt_removed,
    p_cnt_failed: delta.cnt_failed,
    p_sum_ms: delta.sum_ms,
  });
}

/**
 * Lightweight suggestion: proposes a small minConfidence nudge based on win rate.
 * (Does not change runtime policy — you can wire an admin accept flow later.)
 */
export function suggestMinConfidenceBump(winRate: number): number {
  // Conservative bounds: ±0.03 per week window
  if (!Number.isFinite(winRate)) return 0;
  if (winRate > 0.85) return 0.02;
  if (winRate < 0.6) return -0.02;
  return 0;
}

// Fallback inference if adapter isn’t stored:
function inferAdapterFromBrokerOrUrl(brokerOrUrl: string) {
  const s = (brokerOrUrl || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}
