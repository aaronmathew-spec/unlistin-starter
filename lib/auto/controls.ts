// lib/auto/controls.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type AdapterControl = {
  adapter_id: string;
  killed: boolean;
  daily_cap: number | null;       // 0 or null = unlimited
  min_confidence: number | null;  // 0.500..0.990 or null to use defaults
};

export type ControlsMap = Record<string, AdapterControl>;

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/** Load adapter_controls once per request as a map (lowercased keys) */
export async function loadControlsMap(): Promise<ControlsMap> {
  const db = supa();
  const { data } = await db.from("adapter_controls").select("*");
  const map: ControlsMap = {};
  (data || []).forEach((r: any) => {
    if (!r?.adapter_id) return;
    map[String(r.adapter_id).toLowerCase()] = {
      adapter_id: String(r.adapter_id).toLowerCase(),
      killed: !!r.killed,
      daily_cap: Number.isFinite(r.daily_cap) ? Number(r.daily_cap) : null,
      min_confidence: Number.isFinite(r.min_confidence) ? Number(r.min_confidence) : null,
    };
  });
  return map;
}

export function isKilled(controls: ControlsMap, adapterId: string): boolean {
  const c = controls[adapterId?.toLowerCase()];
  return !!c?.killed;
}

export function minConfidence(controls: ControlsMap, adapterId: string, fallback: number): number {
  const c = controls[adapterId?.toLowerCase()];
  if (c?.min_confidence && c.min_confidence >= 0.5 && c.min_confidence <= 0.99) return c.min_confidence;
  return fallback;
}

/**
 * Check a simple daily cap per adapter (server-side).
 * Returns true if under cap (or no cap), false if cap reached.
 */
export async function underDailyCap(adapterId: string, opts?: { countSent?: boolean }): Promise<boolean> {
  const db = supa();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const startIso = dayStart.toISOString();

  // Read cap
  const { data: capRow } = await db
    .from("adapter_controls")
    .select("daily_cap")
    .eq("adapter_id", adapterId.toLowerCase())
    .maybeSingle();

  const cap = (capRow?.daily_cap ?? 0) as number;
  if (!cap || cap <= 0) return true; // unlimited

  // Count actions for today for this adapter
  const statusFilter = opts?.countSent ? "sent" : "prepared";
  const { count } = await db
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("adapter", adapterId.toLowerCase())
    .eq("status", statusFilter as any)
    .gte("created_at", startIso);

  const c = typeof count === "number" ? count : 0;
  return c < cap;
}
