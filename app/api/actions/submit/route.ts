/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { getCapability } from "@/lib/auto/capability";
import { queueEmailFromAction } from "@/lib/mailer";
import { recordOutcome } from "@/lib/auto/learn";
import { beat } from "@/lib/ops/heartbeat";
import { isKilled, loadControlsMap, minConfidence, underDailyCap } from "@/lib/auto/controls";

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
 * POST /api/actions/submit
 * Body: { limit?: number }
 *
 * Phase 1 Auto-Submit (email-only) with admin overrides:
 *  - adapter_controls: killed, daily_cap, min_confidence
 *  - allowlist + capability gates still apply
 */
export async function POST(req: Request) {
  await beat("actions.submit");

  let limit = 10;
  try {
    const body = await req.json().catch(() => ({}));
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(50, body.limit));
  } catch {
    // ignore
  }

  const db = supa();

  // Fetch eligible actions
  const { data: actions, error } = await db
    .from("actions")
    .select("id, broker, category, status, evidence, draft_subject, draft_body, fields, reply_channel, reply_email_preview, meta, state, adapter, confidence")
    .eq("status", "prepared")
    .limit(limit);

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  if (!actions || actions.length === 0) return NextResponse.json({ ok: true, sent: 0, actions: [] });

  const controls = await loadControlsMap();
  const sentIds: number[] = [];

  for (const act of actions) {
    try {
      // must be email channel
      if ((act.reply_channel || "email") !== "email") continue;

      const ev = Array.isArray(act.evidence) ? act.evidence : [];
      const url = ev[0]?.url;
      if (!url || !isAllowed(url)) continue;

      // adapter capability
      const adapterId = (act as any).adapter || inferAdapterFrom(act.broker, url);
      const cap = getCapability(adapterId);

      // admin kill switch
      if (isKilled(controls, adapterId)) continue;

      // min-confidence override (fall back to capability default or 0.82)
      const rawConf = Number.isFinite((act as any).confidence) ? Number((act as any).confidence) : (act.meta?.confidence ?? null);
      const hitConf = Number.isFinite(rawConf) ? Number(rawConf) : 1;
      const threshold = minConfidence(controls, adapterId, cap.defaultMinConfidence ?? 0.82);
      if (hitConf < threshold) continue;

      // daily cap (count 'sent')
      const capOk = await underDailyCap(adapterId, { countSent: true });
      if (!capOk) continue;

      if (!cap.canAutoSubmitEmail) continue;

      // queue outbox (no body persisted)
      const queued = await queueEmailFromAction({
        actionId: act.id,
        broker: act.broker,
        subjectPreview: (act.draft_subject || "Data request").slice(0, 160),
        hasBody: !!act.draft_body,
      });
      if (!queued.ok) continue;

      // Update action -> 'sent'
      const { error: uerr } = await db.from("actions").update({ status: "sent" }).eq("id", act.id);
      if (uerr) continue;

      // Learning hook
      await recordOutcome({
        action_id: act.id,
        broker: act.broker,
        state: (act as any).state || null,
        adapter: adapterId,
        resolution: "sent",
        took_ms: null,
      });

      sentIds.push(act.id);
    } catch {
      // skip this action on any unexpected error
      continue;
    }
  }

  return NextResponse.json({ ok: true, sent: sentIds.length, action_ids: sentIds });
}

function inferAdapterFrom(broker: string, url?: string) {
  const s = (broker || url || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}
