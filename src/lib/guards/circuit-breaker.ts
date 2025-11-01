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

// In-memory sliding window (per runtime instance)
type Fail = { at: number; code?: string | null };
const mem = new Map<string, Fail[]>();

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Prune entries older than the current window, in-place without new array allocs.
 * Uses a two-pointer compaction to avoid touching undefined indexes.
 */
function prune(list: Fail[]): void {
  const cutoff = now() - WINDOW_SECONDS;
  let write = 0;
  for (let read = 0; read < list.length; read++) {
    const item: Fail | undefined = list[read];
    if (item && item.at >= cutoff) {
      if (write !== read) list[write] = item;
      write++;
    }
  }
  if (write < list.length) list.length = write;
}

export async function shouldAllowController(keyRaw: string): Promise<{
  allow: boolean;
  recentFailures: number;
  windowSecs: number;
}> {
  const key = String(keyRaw || "").toLowerCase().trim();
  if (!ENABLED || !key) {
    return { allow: true, recentFailures: 0, windowSecs: WINDOW_SECONDS };
  }

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
): Promise<void> {
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

    await sb.from("ops_controller_failures").insert({
      controller_key: key,
      reason: reason ?? null,
      note: note ?? null,
    });
  } catch {
    // ignore — breaker must never crash
  }
}
