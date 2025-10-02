// app/api/actions/status/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { recordOutcome } from "@/lib/auto/learn";
import { getCapability } from "@/lib/auto/capability";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

/**
 * POST /api/actions/status
 * Body: { id: number, status: 'prepared'|'sent'|'resolved'|'failed', resolution?: 'removed'|'failed', took_ms?: number }
 *
 * - Updates the action status (RLS applies).
 * - Records outcome for learning.
 * - If status moves to 'sent', schedules a follow-up if adapter metadata allows.
 */
export async function POST(req: Request) {
  const db = supa();
  let b: any = null;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = Number(b?.id || 0);
  const status = (b?.status || "").toString();
  const resolution = (b?.resolution || null) as "removed" | "failed" | null;
  const took_ms = Number.isFinite(b?.took_ms) ? Number(b?.took_ms) : null;

  if (!id || !status) return json({ ok: false, error: "Missing id or status" }, { status: 400 });

  // Fetch the action to get broker/url/preview/state for learning & followups
  const { data: act, error: gerr } = await db
    .from("actions")
    .select("id, broker, category, status, evidence, meta, state, adapter")
    .eq("id", id)
    .maybeSingle();

  if (gerr) return json({ ok: false, error: gerr.message }, { status: 400 });
  if (!act) return json({ ok: false, error: "Not found" }, { status: 404 });

  const { error: uerr, data: updated } = await db
    .from("actions")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (uerr) return json({ ok: false, error: uerr.message }, { status: 400 });

  // Learning hook
  const adapterId = (act as any).adapter || inferAdapterFrom(act.broker, act.evidence?.[0]?.url);
  if (status === "resolved" && resolution === "removed") {
    await recordOutcome({
      action_id: id,
      broker: act.broker,
      state: (act as any).state || null,
      adapter: adapterId,
      resolution: "removed",
      took_ms,
    });
  } else if (status === "failed") {
    await recordOutcome({
      action_id: id,
      broker: act.broker,
      state: (act as any).state || null,
      adapter: adapterId,
      resolution: "failed",
      took_ms,
    });
  } else if (status === "sent") {
    await recordOutcome({
      action_id: id,
      broker: act.broker,
      state: (act as any).state || null,
      adapter: adapterId,
      resolution: "sent",
      took_ms,
    });

    // Schedule follow-up if capability permits
    const cap = getCapability(adapterId);
    if (cap.followupCadenceDays && (cap.maxFollowups ?? 0) > 0) {
      // Count existing followups for this parent action
      const { data: fcount } = await db
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("parent_action_id", id);

      const cnt = (fcount as any)?.length ? (fcount as any).length : (fcount as any)?.count || 0;
      if (cnt < (cap.maxFollowups ?? 0)) {
        const nextAt = new Date(Date.now() + cap.followupCadenceDays * 86400 * 1000).toISOString();
        await db.from("followups").insert({
          parent_action_id: id,
          due_at: nextAt,
          adapter: adapterId,
          broker: act.broker,
          state: (act as any).state || null,
          n: cnt + 1,
        });
      }
    }
  } else if (status === "prepared") {
    await recordOutcome({
      action_id: id,
      broker: act.broker,
      state: (act as any).state || null,
      adapter: adapterId,
      resolution: "prepared",
      took_ms,
    });
  }

  return NextResponse.json({ ok: true, action: updated });
}

function inferAdapterFrom(broker: string, url?: string) {
  const s = (broker || url || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}
