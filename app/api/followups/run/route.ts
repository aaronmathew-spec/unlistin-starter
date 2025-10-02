/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCapability } from "@/lib/auto/capability";
import { sha256Hex, signEnvelope } from "@/lib/ledger";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { beat } from "@/lib/ops/heartbeat";
import { isKilled, loadControlsMap, underDailyCap } from "@/lib/auto/controls";

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
 * POST /api/followups/run
 * Body: { limit?: number }
 *
 * - Picks due follow-ups.
 * - Prepares a new "prepared" action using prior redacted draft (no new AI call).
 * - Respect allowlist, adapter caps, and admin kill-switch.
 * - Marks followup as scheduled=true.
 */
export async function POST(req: Request) {
  await beat("followups.run");

  let limit = 10;
  try {
    const body = await req.json().catch(() => ({}));
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(50, body.limit));
  } catch {
    // ignore
  }

  const db = supa();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await db
    .from("followups")
    .select("*")
    .lte("due_at", nowIso)
    .eq("scheduled", false)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  if (!due || due.length === 0) return NextResponse.json({ ok: true, prepared: 0, actions: [] });

  const controls = await loadControlsMap();
  const prepared: any[] = [];

  for (const f of due) {
    const adapterId = (f.adapter || "generic").toLowerCase();

    // Admin kill/cap checks
    if (isKilled(controls, adapterId)) {
      await db.from("followups").update({ scheduled: true, note: "adapter-killed" }).eq("id", f.id);
      continue;
    }
    const capOk = await underDailyCap(adapterId, { countSent: false });
    if (!capOk) {
      await db.from("followups").update({ scheduled: true, note: "adapter-cap-reached" }).eq("id", f.id);
      continue;
    }

    const cap = getCapability(adapterId);

    // Load parent action (for redacted draft + evidence)
    const { data: parent } = await db
      .from("actions")
      .select(
        "id, broker, category, redacted_identity, evidence, draft_subject, draft_body, fields, reply_channel, reply_email_preview"
      )
      .eq("id", f.parent_action_id)
      .maybeSingle();

    if (!parent) {
      await db.from("followups").update({ scheduled: true, note: "parent-missing" }).eq("id", f.id);
      continue;
    }

    const ev = Array.isArray(parent.evidence) ? parent.evidence : [];
    const url = ev[0]?.url;
    if (!url || !isAllowed(url)) {
      await db.from("followups").update({ scheduled: true, note: "evidence-not-allowlisted" }).eq("id", f.id);
      continue;
    }

    // Proof-of-Action for the follow-up (PII-safe)
    const env = {
      id: "pending",
      broker: parent.broker,
      category: parent.category || "directory",
      redacted_identity: parent.redacted_identity || {},
      evidence_urls: [url],
      draft_subject_hash: parent.draft_subject ? sha256Hex(parent.draft_subject) : undefined,
      timestamp: new Date().toISOString(),
    };
    const proof = signEnvelope(env);

    const row = {
      broker: parent.broker,
      category: parent.category || "directory",
      status: "prepared",
      redacted_identity: parent.redacted_identity,
      evidence: parent.evidence,
      draft_subject: parent.draft_subject,
      draft_body: parent.draft_body,
      fields: parent.fields,
      reply_channel: parent.reply_channel || "email",
      reply_email_preview: parent.reply_email_preview || null,
      proof_hash: proof.hash,
      proof_sig: proof.sig,
      adapter: adapterId,
      meta: { followup_of: parent.id, n: f.n, adapter: adapterId },
    };

    const { data: created, error: ierr } = await db.from("actions").insert(row).select("*").maybeSingle();
    if (!ierr && created) {
      prepared.push(created);
      // mark followup scheduled
      await db.from("followups").update({ scheduled: true }).eq("id", f.id);

      // queue another follow-up if within cap
      const countNext = f.n + 1;
      if ((cap.maxFollowups ?? 0) >= countNext && cap.followupCadenceDays) {
        const nextAt = new Date(Date.now() + cap.followupCadenceDays * 86400 * 1000).toISOString();
        await db.from("followups").insert({
          parent_action_id: parent.id,
          due_at: nextAt,
          adapter: adapterId,
          broker: parent.broker,
          state: f.state || null,
          n: countNext,
        });
      }
    } else {
      await db.from("followups").update({ scheduled: true, note: ierr?.message || "insert-failed" }).eq("id", f.id);
    }
  }

  return NextResponse.json({ ok: true, prepared: prepared.length, actions: prepared });
}
