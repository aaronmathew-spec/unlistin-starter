// src/lib/guards/circuit-breaker.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

// Optional, resilient circuit breaker to avoid hot controllers.
// If FLAG_CIRCUIT_BREAKER !== "1", this gate always allows.
//
// If enabled, we keep a tiny in-memory counter per controller key for the
// current runtime instance and (best-effort) mirror to Supabase if a table
// exists. Nothing here should crash your worker.

const ENABLED = process.env.FLAG_CIRCUIT_BREAKER === "1";

// Soft thresholds
const WINDOW_SECONDS = Number(process.env.CB_WINDOW_SECS ?? 600); // 10 min
const MAX_RECENT_FAILS = Number(process.env.CB_MAX_RECENT_FAILS ?? 5);

// In-memory sliding window (per edge function instance)
type Fail = { at: number; code?: string | null };
const mem = new Map<string, Fail[]>();

function now() {
  return Math.floor(Date.now() / 1000);
}

function prune(list: Fail[]) {
  const cutoff = now() - WINDOW_SECONDS;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].at < cutoff) list.splice(i, 1);
  }
}

export async function shouldAllowController(keyRaw: string) {
  const key = String(keyRaw || "").toLowerCase().trim();
  if (!ENABLED || !key) return { allow: true, recentFailures: 0, windowSecs: WINDOW_SECONDS };

  const list = mem.get(key) ?? [];
  prune(list);
  const recent = list.length;

  const allow = recent < MAX_RECENT_FAILS;
  return { allow, recentFailures: recent, windowSecs: WINDOW_SECONDS };
}

export async function recordControllerFailure(
  keyRaw: string,
  reason?: string | null,
  note?: string | null
) {
  const key = String(keyRaw || "").toLowerCase().trim();
  if (!key) return;

  // in-memory
  const list = mem.get(key) ?? [];
  list.push({ at: now(), code: reason ?? undefined });
  prune(list);
  mem.set(key, list);

  // best-effort persist (optional): ops_controller_failures(controller_key, reason, note, created_at)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sr = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !sr) return;

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, sr, { auth: { persistSession: false } });

    // Attempt insert; ignore schema errors
    await sb.from("ops_controller_failures").insert({
      controller_key: key,
      reason: reason ?? null,
      note: note ?? null,
    });
  } catch {
    // ignore — breaker must never crash
  }
}
