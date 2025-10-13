// src/agents/dispatch/send.ts
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "./email";
import { submitForm } from "./form";
import { callApi } from "./api";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Picks up actions with status='draft' for a subject and dispatches them.
 * Updates each action to 'sent' or 'failed' with a receipt/error.
 */
export async function dispatchDraftsForSubject(subjectId: string) {
  const supabase = db();

  // 1) Load drafts + controller channel data (email/form/api endpoints)
  const { data: drafts, error } = await supabase
    .from("actions")
    .select(
      `
      id, subject_id, controller_id, channel, to, content, payload, status, created_at,
      controllers:controller_id ( id, name, channels, sla_days )
    `
    )
    .eq("subject_id", subjectId)
    .eq("status", "draft");

  if (error) throw new Error(`[dispatch] cannot read actions: ${error.message}`);
  if (!drafts || drafts.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const a of drafts) {
    const channel: string = (a as any).channel;
    const to: string | null = (a as any).to ?? null;
    const content: string | null = (a as any).content ?? null;
    const payload: any = (a as any).payload ?? null;

    try {
      if (channel === "email") {
        const subj = payload?.subject || "Data Deletion Request";
        const dest = to || payload?.to;
        const body = content || payload?.body || "";
        const res = await sendEmail({ to: String(dest), subject: String(subj), body });
        if (!res.ok) throw new Error(res.error);
        await supabase
          .from("actions")
          .update({ status: "sent", dispatch_info: { channel, receipt: res.messageId } })
          .eq("id", a.id);
        sent++;
      } else if (channel === "form") {
        const formUrl = payload?.formUrl || to;
        if (!formUrl) throw new Error("Missing formUrl");
        const res = await submitForm({ formUrl, fields: payload?.fields || {} });
        if (!res.ok) throw new Error(res.error);
        await supabase
          .from("actions")
          .update({ status: "sent", dispatch_info: { channel, receipt: res.receipt } })
          .eq("id", a.id);
        sent++;
      } else if (channel === "api") {
        const endpoint = payload?.endpoint || to;
        if (!endpoint) throw new Error("Missing api endpoint");
        const res = await callApi({
          endpoint,
          method: payload?.method || "POST",
          headers: payload?.headers || {},
          body: payload?.body || {},
        });
        if (!res.ok) throw new Error(res.error);
        await supabase
          .from("actions")
          .update({ status: "sent", dispatch_info: { channel, receipt: res.receipt } })
          .eq("id", a.id);
        sent++;
      } else {
        throw new Error(`Unsupported channel: ${channel}`);
      }
    } catch (e: any) {
      await supabase
        .from("actions")
        .update({ status: "failed", dispatch_info: { channel, error: String(e?.message || e) } })
        .eq("id", a.id);
      failed++;
    }
  }

  return { processed: drafts.length, sent, failed };
}
