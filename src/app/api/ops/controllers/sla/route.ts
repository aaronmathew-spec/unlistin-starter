// src/app/api/ops/controllers/sla/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, svc, { auth: { persistSession: false } });

// Status classification
const OK_STATUSES = new Set(["verified"]);
const REVIEW_STATUSES = new Set(["needs_review"]);
const SENDING_STATUSES = new Set(["sent", "escalated", "escalate_pending", "dispatching"]);

type Bucket = {
  controllerId: string | null;
  total: number;
  ok: number;
  review: number;
  sending: number;
  failed: number;
};

type ControllerMeta = { name: string; domain: string | null };

export async function GET(_req: NextRequest) {
  try {
    const supa = getServerSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // RLS-scoped via join to subjects (user owns subjects)
    const { data: rows, error } = await db
      .from("actions")
      .select("controller_id,status,created_at,subject_id,subjects!inner(user_id)")
      .eq("subjects.user_id", user.id)
      .gte("created_at", cutoff)
      .limit(5000);

    if (error) throw new Error(error.message);

    // Aggregate
    const map = new Map<string, Bucket>();
    for (const r of rows ?? []) {
      const cid = (r as any).controller_id ?? "unknown";
      if (!map.has(cid)) {
        map.set(cid, { controllerId: cid, total: 0, ok: 0, review: 0, sending: 0, failed: 0 });
      }
      const b = map.get(cid)!;
      b.total += 1;

      const st = (r as any).status as string | null;
      if (!st) {
        b.failed += 1;
        continue;
      }
      if (OK_STATUSES.has(st)) b.ok += 1;
      else if (REVIEW_STATUSES.has(st)) b.review += 1;
      else if (SENDING_STATUSES.has(st)) b.sending += 1;
      else b.failed += 1;
    }

    const buckets = Array.from(map.values());

    // Enrich metadata for known controller IDs
    const ids = buckets
      .map((b) => b.controllerId)
      .filter((x): x is string => typeof x === "string" && x.length > 0 && x !== "unknown");

    let meta: Record<string, ControllerMeta> = {};
    if (ids.length > 0) {
      const { data: ctrls, error: ctrlErr } = await db
        .from("controllers")
        .select("id,name,domain")
        .in("id", ids);

      if (ctrlErr) throw new Error(ctrlErr.message);
      meta = Object.fromEntries(
        (ctrls ?? []).map((c: any) => [
          c.id as string,
          {
            name: (c.name as string) ?? "Unknown",
            domain: (c.domain as string) ?? null,
          },
        ])
      );
    }

    // Shape response (safe defaulting; no `&&` that can yield "")
    const out = buckets
      .map((b) => {
        const m: ControllerMeta =
          (b.controllerId ? meta[b.controllerId] : undefined) ?? { name: "Unknown", domain: null };

        const okRate = b.total > 0 ? b.ok / b.total : 0;
        return {
          controllerId: b.controllerId,
          name: m.name,
          domain: m.domain,
          total: b.total,
          ok: b.ok,
          needsReview: b.review,
          sending: b.sending,
          failed: b.failed,
          okRate,
        };
      })
      .sort((a, b) => a.okRate - b.okRate);

    return NextResponse.json({ windowStart: cutoff, controllers: out });
  } catch (e: any) {
    console.error("[ops/controllers/sla] error:", e?.message || e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
