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
import { chunk, mapWithConcurrency } from "@/lib/utils/batch";

type ActionRow = {
  id: number;
  broker: string;
  category: string | null;
  status: string;
  evidence: Array<{ url?: string }> | null;
  draft_subject: string | null;
  draft_body: string | null;
  fields: any;
  reply_channel: string | null;
  reply_email_preview: string | null;
  meta: Record<string, any> | null;
  state: string | null;
  adapter: string | null;
  confidence?: number | null;
};

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
 *  - MEGA BATCH: chunks of 50, concurrency=5
 */
export async function POST(req: Request) {
  await beat("actions.submit");

  // -------- inputs ----------
  let limit = 50;
  try {
    const body = await req.json().catch(() => ({}));
    if (Number.isFinite(body?.limit)) {
      limit = Math.max(1, Math.min(500, body.limit));
    }
  } catch {
    /* ignore */
  }

  const db = supa();

  // -------- fetch candidates ----------
  const { data: actions, error } = await db
    .from("actions")
    .select(
      "id, broker, category, status, evidence, draft_subject, draft_body, fields, reply_channel, reply_email_preview, meta, state, adapter, confidence"
    )
    .eq("status", "prepared")
    .limit(limit);

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  const rows: ActionRow[] = Array.isArray(actions) ? actions : [];
  if (rows.length === 0) return NextResponse.json({ ok: true, sent: 0, action_ids: [] });

  const controls = await loadControlsMap();
  const sentIds: number[] = [];

  // -------- batch process ----------
  const batches = chunk(rows, 50);

  for (const batch of batches) {
    const { results } = await mapWithConcurrency(batch, 5, async (act) => {
      try {
        // must be email channel (default to email)
        if ((act.reply_channel || "email") !== "email") return false;

        const ev = Array.isArray(act.evidence) ? act.evidence : [];
        const url = ev[0]?.url;
        if (!url || !isAllowed(url)) return false;

        const adapterId = (act.adapter || inferAdapterFrom(act.broker, url)).toLowerCase();
        const cap = getCapability(adapterId);

        // admin kill switch
        if (isKilled(controls, adapterId)) return false;

        // min-confidence override (fall back to capability default or 0.82)
        const rawConf =
          Number.isFinite(act.confidence) && act.confidence != null
            ? Number(act.confidence)
            : (act.meta?.confidence as number | undefined) ?? null;
        const hitConf = Number.isFinite(rawConf) && rawConf != null ? Number(rawConf) : 1;
        const threshold = minConfidence(controls, adapterId, cap.defaultMinConfidence ?? 0.82);
        if (hitConf < threshold) return false;

        // daily cap (count 'sent')
        const capOk = await underDailyCap(adapterId, { countSent: true });
        if (!capOk) return false;

        if (!cap.canAutoSubmitEmail) return false;

        // queue outbox (no body persisted)
        const queued = await queueEmailFromAction({
          actionId: act.id,
          broker: act.broker,
          subjectPreview: (act.draft_subject || "Data request").slice(0, 160),
          hasBody: !!act.draft_body,
        });
        if (!queued.ok) return false;

        // Update action -> 'sent'
        const { error: uerr } = await db.from("actions").update({ status: "sent" }).eq("id", act.id);
        if (uerr) return false;

        // Learning hook
        await recordOutcome({
          action_id: act.id,
          broker: act.broker,
          state: act.state || null,
          adapter: adapterId,
          resolution: "sent",
          took_ms: null,
        });

        sentIds.push(act.id);
        return true;
      } catch {
        return false;
      }
    });

    // Optional small pause to be gentle with rate limits
    if (results.length > 0) await new Promise((r) => setTimeout(r, 25));
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
