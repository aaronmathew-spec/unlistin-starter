/* src/lib/ops/dlq.ts
 * Server-only DLQ helpers for the Ops UI.
 *
 * Table: public.ops_dlq
 * Columns: id, created_at, channel, controller_key, subject_id, payload, error_code, error_note, retries
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import sendControllerRequest from "@/lib/dispatch/send";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

export type DLQRow = {
  id: string | number;
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
    .limit(Math.max(1, Math.min(1000, limit)));
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
  } as any);
  if (error) throw error;
  return { ok: true };
}

export async function deleteDLQ(id: string | number) {
  const client = sb();
  const { error } = await client.from("ops_dlq").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

/**
 * Retry semantics:
 * - Replays the original dispatch using sendControllerRequest.
 * - On success: deletes DLQ row.
 * - On failure: increments retries and annotates error fields.
 */
export async function retryDLQ(id: string | number) {
  const client = sb();

  // Load the DLQ row
  const { data, error } = await client
    .from("ops_dlq")
    .select("id, channel, controller_key, subject_id, payload, retries")
    .eq("id", id)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "dlq_not_found" };
  }

  const row = data as DLQRow & { retries: number | null };
  const payload = (row.payload || {}) as Record<string, any>;
  const channel = String(row.channel || "").toLowerCase();

  // Normalize fields expected by sendControllerRequest
  const controllerKey =
    (payload.controllerKey as string | undefined) ??
    (row.controller_key as string | undefined) ??
    "unknown";
  const controllerName =
    (payload.controllerName as string | undefined) ?? controllerKey;

  const subject = {
    name:
      (payload.subject?.name as string | undefined) ??
      (payload.subject?.fullName as string | undefined) ??
      "Unknown Subject",
    email: (payload.subject?.email as string | null | undefined) ?? null,
    phone: (payload.subject?.phone as string | null | undefined) ?? null,
    handle: (payload.subject?.handle as string | null | undefined) ?? null,
    id:
      (payload.subject?.id as string | null | undefined) ??
      (row.subject_id as string | null | undefined) ??
      null,
  };

  const locale = (payload.locale as string | undefined) ?? "en-IN";
  const draft = (payload.draft as any) ?? {
    subjectLine: payload.subjectLine ?? null,
    bodyText: payload.bodyText ?? null,
  };
  const formUrl = (payload.formUrl as string | null | undefined) ?? null;

  try {
    // Call matches ControllerRequestInput / SendInput (no 'region' prop)
    const res = await sendControllerRequest({
      controllerKey,
      controllerName,
      subject,
      locale,
      draft,
      formUrl,
      action: "retry_request_v1",
      subjectId: subject.id,
    });

    if (res.ok) {
      await client.from("ops_dlq").delete().eq("id", id);
      return {
        ok: true,
        requeued: true,
        channel: res.channel ?? channel,
        note: `Retried via ${res.channel ?? "webform"}`,
      };
    }

    const retries = (row.retries ?? 0) + 1;
    await client
      .from("ops_dlq")
      .update({
        retries,
        error_code: res.error ?? "retry_failed",
        error_note: res.note ?? null,
      } as any)
      .eq("id", id);

    return { ok: false, error: res.error || "retry_failed", requeued: false };
  } catch (e: any) {
    const msg = String(e?.message || e);
    const retries = (row.retries ?? 0) + 1;
    await client
      .from("ops_dlq")
      .update({
        retries,
        error_code: "retry_exception",
        error_note: msg,
      } as any)
      .eq("id", id);
    return { ok: false, error: msg, requeued: false };
  }
}
