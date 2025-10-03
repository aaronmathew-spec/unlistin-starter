/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ensureAiLimit } from "@/lib/ratelimit";
import { selectFollowupCandidates, ActionRow } from "@/lib/auto/followups";
// Allowlist kept for future use if we attach evidence-based retries
import { isAllowed } from "@/lib/scan/domains-allowlist";

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
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * POST /api/followups/run
 * Body (optional): { limit?: number }
 *
 * Behavior:
 *  - Selects candidate actions (status=sent|pending_response)
 *  - Applies confidence bands + adapter capability policy
 *  - Performs a safe "nudge": increments attempts metadata when available,
 *    otherwise falls back to status-only update.
 *  - Returns a summary.
 *
 * Notes:
 *  - No raw PII is processed or returned.
 *  - If the schema lacks the `attempts` column, the update gracefully omits it.
 */
export async function POST(req: Request) {
  const rl = await ensureAiLimit(req);
  if (!rl?.ok) return json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });

  const db = supa();

  let limit = 20;
  try {
    const body = await req.json();
    if (body && Number.isFinite(body.limit)) limit = Math.max(1, Math.min(100, Number(body.limit)));
  } catch {
    // ignore parse errors; use default
  }

  // Pull recent actions that may need a followup. Keep selection broad; policy will filter.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(); // last 14 days window
  const { data, error } = await db
    .from("actions")
    .select(
      "id, broker, category, status, inserted_at, adapter, confidence, attempts, reply_channel, reply_email_preview"
    )
    .in("status", ["sent", "pending_response"])
    .gte("inserted_at", since)
    .order("inserted_at", { ascending: true })
    .limit(400); // filtered in memory

  if (error) return json({ ok: false, error: error.message }, { status: 400 });

  const rows = (Array.isArray(data) ? data : []) as ActionRow[];
  const candidates = selectFollowupCandidates(rows, Date.now(), limit);

  const results: Array<{ id: ActionRow["id"]; ok: boolean; reason?: string }> = [];

  for (const c of candidates) {
    // Safe, idempotent "nudge": set status back to "sent" and increment attempts if column exists.
    let ok = false;
    let reason = c.reason;

    try {
      const { error: e1 } = await db
        .from("actions")
        .update(
          {
            // If the column exists, this will succeed; if not, Supabase will error and we'll fall back.
            // We use `as any` on the whole object to avoid strict type coupling to the DB schema.
            attempts: (c.attempts ?? 0) + 1,
            status: "sent",
          } as any
        )
        .eq("id", c.id);
      if (!e1) {
        ok = true;
      } else {
        // fallback: update only status
        const { error: e2 } = await db.from("actions").update({ status: "sent" } as any).eq("id", c.id);
        ok = !e2;
        if (e1 && !e2) reason += " (attempts column missing; status bumped)";
      }
    } catch {
      // As a last resort, try status-only update
      const { error: e3 } = await db.from("actions").update({ status: "sent" } as any).eq("id", c.id);
      ok = !e3;
      if (!ok) reason += " (update failed)";
    }

    results.push({ id: c.id, ok, reason });
  }

  return NextResponse.json({
    ok: true,
    considered: rows.length,
    selected: candidates.length,
    updated: results.filter((r) => r.ok).length,
    results,
  });
}
