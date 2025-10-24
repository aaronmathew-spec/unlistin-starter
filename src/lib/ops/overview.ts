// src/lib/ops/overview.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export type OverviewStats = {
  // dispatch_audit
  dispatch_today: number;
  dispatch_24h_ok: number;
  dispatch_24h_err: number;

  // dlq
  dlq_count: number;

  // verifications
  verif_total: number;
  verif_pending: number;
  verif_due: number;   // next_recheck_at <= now
};

export async function loadOverview(): Promise<OverviewStats> {
  const client = sb();
  if (!client) {
    return {
      dispatch_today: 0,
      dispatch_24h_ok: 0,
      dispatch_24h_err: 0,
      dlq_count: 0,
      verif_total: 0,
      verif_pending: 0,
      verif_due: 0,
    };
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const dayIso = startOfDay.toISOString();
  const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // --- dispatch_audit quick counts ---
  let dispatch_today = 0;
  let dispatch_24h_ok = 0;
  let dispatch_24h_err = 0;
  try {
    // Today
    {
      const { count } = await client
        .from("dispatch_audit")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayIso);
      dispatch_today = count ?? 0;
    }
    // 24h OK
    {
      const { count } = await client
        .from("dispatch_audit")
        .select("*", { count: "exact", head: true })
        .gte("created_at", minus24h)
        .eq("ok", true);
      dispatch_24h_ok = count ?? 0;
    }
    // 24h ERR
    {
      const { count } = await client
        .from("dispatch_audit")
        .select("*", { count: "exact", head: true })
        .gte("created_at", minus24h)
        .eq("ok", false);
      dispatch_24h_err = count ?? 0;
    }
  } catch {
    // tolerate missing table
  }

  // --- dlq count ---
  let dlq_count = 0;
  try {
    const { count } = await client
      .from("ops_dlq")
      .select("*", { count: "exact", head: true });
    dlq_count = count ?? 0;
  } catch {
    // tolerate missing table
  }

  // --- verifications snapshot ---
  let verif_total = 0;
  let verif_pending = 0;
  let verif_due = 0;
  try {
    const pendingSet = new Set(["pending", "awaiting", "submitted", "queued", "checking"]);

    // total
    {
      const { count } = await client
        .from("verifications")
        .select("*", { count: "exact", head: true });
      verif_total = count ?? 0;
    }

    // pending
    {
      // If Postgres: use `in` OR multiple eq; for head queries we can’t OR easily, fallback to a regular select & count client-side if needed.
      const { data, error } = await client
        .from("verifications")
        .select("status, next_recheck_at, updated_at")
        .limit(5000); // cap for safety
      if (!error && data) {
        const nowMs = Date.now();
        verif_pending = data.filter((r: any) => pendingSet.has(String(r.status || "").toLowerCase())).length;
        verif_due = data.filter((r: any) => {
          const due = r.next_recheck_at ? new Date(r.next_recheck_at).getTime() <= nowMs : false;
          return due;
        }).length;
      }
    }
  } catch {
    // tolerate missing table
  }

  return {
    dispatch_today,
    dispatch_24h_ok,
    dispatch_24h_err,
    dlq_count,
    verif_total,
    verif_pending,
    verif_due,
  };
}
