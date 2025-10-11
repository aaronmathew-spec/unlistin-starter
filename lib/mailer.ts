/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mailer facade:
 * - queueEmailFromAction(...)  (already used by auto-submit)
 * - sendQueuedEmails({ limit }) (drains outbox with a provider or mock)
 *
 * By default, uses a **mock provider** (no external calls).
 * To enable SendGrid: set MAIL_PROVIDER=sendgrid and SENDGRID_API_KEY + MAIL_FROM.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sha256Hex } from "@/lib/ledger";
import type { ProviderResult } from "./mailer/providers/types";
import { sendWithMock } from "./mailer/providers/mock";
// (Optional) SendGrid provider — only used when env says so.
import { sendWithSendgrid } from "./mailer/providers/sendgrid";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export type OutboxQueueResult = { ok: boolean; outboxId?: string; error?: string };

export async function queueEmailFromAction(params: {
  actionId: number;
  broker: string;
  subjectPreview: string; // redacted/short
  hasBody: boolean;       // true if we had a body (not stored)
}): Promise<OutboxQueueResult> {
  const db = supa();
  const subject_hash = sha256Hex((params.subjectPreview || "").slice(0, 160));
  const { data, error } = await db
    .from("outbox_emails")
    .insert({
      action_id: params.actionId,
      broker: params.broker,
      subject_hash,
      body_present: params.hasBody,
      status: "queued",
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, outboxId: data?.id };
}

/**
 * Drain queued items.
 * We intentionally **do not** include PII bodies here; we re-fetch action for safe hints only.
 * In Phase 1 we send to a sink (DEV_MAIL_SINK) or via a provider address list you control.
 */
export async function sendQueuedEmails(opts?: { limit?: number }): Promise<{ ok: boolean; sent: number; errors: any[] }> {
  const limit = Math.max(1, Math.min(200, Number(opts?.limit ?? 25)));
  const db = supa();

  const { data: rows, error } = await db
    .from("outbox_emails")
    .select("id, action_id, broker, subject_hash, body_present, status")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { ok: false, sent: 0, errors: [error.message] };
  if (!rows?.length) return { ok: true, sent: 0, errors: [] };

  const provider = (process.env.MAIL_PROVIDER || "mock").toLowerCase();
  const send = provider === "sendgrid" ? sendWithSendgrid : sendWithMock;

  let sent = 0;
  const errors: any[] = [];

  for (const r of rows) {
    // Fetch minimal action context (no PII body)
    const { data: action, error: aerr } = await db
      .from("actions")
      .select("id, broker, draft_subject, reply_email_preview, status")
      .eq("id", r.action_id)
      .maybeSingle();

    if (aerr || !action) {
      errors.push({ id: r.id, error: aerr?.message || "action-missing" });
      await db.from("outbox_emails").update({ status: "error", error: "action-missing" }).eq("id", r.id);
      continue;
    }

    // Subject: we only have a hash; we’ll synthesize a neutral subject line + broker
    const subj = `[Unlist.in] Request to ${action.broker || "provider"}`;

    // Recipient sink:
    //  - In dev: DEV_MAIL_SINK="you@domain"
    //  - In prod: your provider can route based on broker; for now send to a sink or noop
    const to = process.env.DEV_MAIL_SINK || process.env.MAIL_TO || "";
    const body =
      "Hello,\n\nWe’re contacting you regarding a customer’s data removal/correction request. " +
      "This message is a Phase 1 automated submission record. The actual customer identity " +
      "is not included here for privacy; your standard verification flow is expected.\n\n" +
      "— Unlist.in";

    let result: ProviderResult;
    try {
      result = await send({ to, subject: subj, text: body });
    } catch (e: any) {
      result = { ok: false, error: e?.message || "provider-error" };
    }

    if (result.ok) {
      await db
        .from("outbox_emails")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", r.id);
      sent++;
    } else {
      await db
        .from("outbox_emails")
        .update({ status: "error", error: String(result.error || "send-failed") })
        .eq("id", r.id);
      errors.push({ id: r.id, error: result.error || "send-failed" });
    }
  }

  return { ok: true, sent, errors };
}
