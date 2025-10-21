// lib/verify/recheck.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Very small recheck helper:
 * - Finds verification rows that are due (next_recheck_at <= now) or stale-pending.
 * - Marks them as queued for recheck and pushes next_recheck_at forward.
 * - Returns summary so the caller can log/alert.
 *
 * Tune the table/columns below to match your schema.
 */

export type RecheckOptions = {
  windowLimit?: number;           // max rows to scan
  staleMinutes?: number;          // when pending, how old to force recheck
  pushMinutes?: number;           // how far to move next_recheck_at on queue
  dryRun?: boolean;               // don’t write, only report
};

export type RecheckResult = {
  ok: true;
  scanned: number;
  queued: number;
  ids: string[];
} | {
  ok: false;
  error: string;
};

const DEFAULTS: Required<Pick<RecheckOptions, "windowLimit" | "staleMinutes" | "pushMinutes" | "dryRun">> = {
  windowLimit: 2000,
  staleMinutes: 24 * 60,   // 24h
  pushMinutes: 6 * 60,     // +6h
  dryRun: false,
};

// Statuses considered “still pending”
const PENDING = new Set(["pending", "awaiting", "submitted", "queued", "checking"]);

/** Build a Supabase service client (no session persistence) */
export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Core recheck pass. Provide your own client or we’ll create one. */
export async function recheckDueVerifications(
  sb: SupabaseClient | null,
  opts?: RecheckOptions
): Promise<RecheckResult> {
  const o = { ...DEFAULTS, ...(opts || {}) };
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const pushIso = new Date(nowMs + o.pushMinutes * 60_000).toISOString();

  const supabase = sb ?? serviceClient();

  // 1) Pull a window of candidates. Keep columns minimal for perf.
  const { data, error } = await supabase
    .from("verifications")
    .select("id, status, updated_at, next_recheck_at")
    .order("updated_at", { ascending: true })
    .limit(o.windowLimit);

  if (error) {
    return { ok: false, error: error.message };
  }

  type Row = {
    id: string;
    status?: string | null;
    updated_at?: string | null;
    next_recheck_at?: string | null;
  };

  const staleMs = o.staleMinutes * 60_000;

  // 2) Filter: next_recheck_at due OR pending+stale
  const candidates: Row[] = (data || []).filter((r) => {
    const status = (r.status || "").toLowerCase();
    const due = r.next_recheck_at ? new Date(r.next_recheck_at).getTime() <= nowMs : false;
    const lastUpd = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    const tooOld = lastUpd > 0 ? nowMs - lastUpd > staleMs : false;
    const isPending = PENDING.has(status) || status === "";
    return due || (isPending && tooOld);
  });

  if (candidates.length === 0) {
    return { ok: true, scanned: data?.length ?? 0, queued: 0, ids: [] };
  }

  const ids = candidates.map((r) => r.id);

  if (o.dryRun) {
    return { ok: true, scanned: data?.length ?? 0, queued: ids.length, ids };
  }

  // 3) Mark them as queued and push next_recheck_at
  // (If you prefer a different status transition, change "queued" below.)
  const { error: updErr } = await supabase
    .from("verifications")
    .update({ status: "queued", next_recheck_at: pushIso, updated_at: nowIso })
    .in("id", ids);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  return { ok: true, scanned: data?.length ?? 0, queued: ids.length, ids };
}
