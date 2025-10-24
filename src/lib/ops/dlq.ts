// src/lib/ops/dlq.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

// If your project keeps these in a separate helper, feel free to consolidate:
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export type DLQRow = {
  id: string;
  created_at: string;
  channel: "webform" | "email" | string;
  controller_key: string | null;
  subject_id: string | null;
  payload: Record<string, any> | null;
  error_code: string | null;
  error_note: string | null;
  retries: number | null;
};

export async function listDLQ(limit = 200): Promise<DLQRow[]> {
  const client = sb();
  const { data, error } = await client
    .from("ops_dlq")
    .select("id, created_at, channel, controller_key, subject_id, payload, error_code, error_note, retries")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as DLQRow[];
}

type PushArgs = {
  channel: "webform" | "email" | string;
  controller_key?: string | null;
  subject_id?: string | null;
  payload?: Record<string, any> | null;
  error_code?: string | null;
  error_note?: string | null;
  retries?: number | null;
};

export async function pushDLQ(args: PushArgs) {
  const client = sb();
  const { error } = await client.from("ops_dlq").insert({
    channel: args.channel,
    controller_key: args.controller_key ?? null,
    subject_id: args.subject_id ?? null,
    payload: args.payload ?? null,
    error_code: args.error_code ?? null,
    error_note: args.error_note ?? null,
    retries: args.retries ?? 0,
  });
  if (error) throw error;
  return { ok: true };
}

export async function deleteDLQ(id: string) {
  const client = sb();
  const { error } = await client.from("ops_dlq").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

/**
 * Retry semantics:
 * - For channel 'webform', we try to re-enqueue using your existing webform queue.
 * - If enqueue succeeds, we delete the DLQ row.
 * - If enqueue fails, we increment retries and update error_note.
 *
 * Extend this switch with 'email' etc. as you add handlers.
 */
export async function retryDLQ(id: string) {
  const client = sb();

  // Load the DLQ row
  const { data, error } = await client
    .from("ops_dlq")
    .select("id, channel, controller_key, payload, retries")
    .eq("id", id)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "dlq_not_found" };
  }

  const row = data as DLQRow & { retries: number | null };
  const channel = (row.channel || "").toLowerCase();

  try {
    switch (channel) {
      case "webform": {
        // Minimal safety: payload should contain what enqueue needs.
        // Your enqueue expects: { controllerKey, controllerName?, subject, locale?, draft?, formUrl? }
        const payload = (row.payload || {}) as any;

        // Adapter import is local to avoid circular deps on some setups
        const { enqueueWebformJob } = await import("@/lib/webform/queue");

        await enqueueWebformJob({
          controllerKey: payload.controllerKey ?? row.controller_key ?? "generic",
          controllerName: payload.controllerName ?? (row.controller_key ?? "Controller"),
          subject: {
            name: payload.subject?.name ?? undefined,
            email: payload.subject?.email ?? undefined,
            phone: payload.subject?.phone ?? undefined,
            handle: payload.subject?.handle ?? undefined,
            id: payload.subject?.id ?? undefined,
          },
          locale: payload.locale ?? "en-IN",
          draft: payload.draft
            ? { subject: payload.draft.subject ?? "", bodyText: payload.draft.bodyText ?? "" }
            : undefined,
          formUrl: payload.formUrl ?? undefined,
        });

        // On success: delete from DLQ
        await client.from("ops_dlq").delete().eq("id", id);
        return { ok: true, requeued: true, channel: "webform" };
      }

      // Add future cases like 'email' here…

      default: {
        // Unknown channel: leave in DLQ and annotate
        const retries = (row.retries ?? 0) + 1;
        await client
          .from("ops_dlq")
          .update({
            retries,
            error_code: "retry_unsupported_channel",
            error_note: `No retry handler for channel=${channel}`,
          })
          .eq("id", id);
        return { ok: false, error: "unsupported_channel", requeued: false };
      }
    }
  } catch (e: any) {
    const msg = String(e?.message || e);
    const retries = (row.retries ?? 0) + 1;
    await client
      .from("ops_dlq")
      .update({
        retries,
        error_code: "retry_failed",
        error_note: msg,
      })
      .eq("id", id);
    return { ok: false, error: msg, requeued: false };
  }
}
