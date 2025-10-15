// lib/webform/queue.ts
import { createClient } from "@supabase/supabase-js";
import type { EnqueueWebformInput, WebformJob } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase service role env vars missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export async function enqueueWebformJob(input: EnqueueWebformInput): Promise<WebformJob> {
  const sb = srv();
  const { data, error } = await sb
    .from("webform_jobs")
    .insert({
      controller_key: input.controllerKey,
      controller_name: input.controllerName,
      subject_name: input.subject.name ?? null,
      subject_email: input.subject.email ?? null,
      subject_phone: input.subject.phone ?? null,
      locale: input.locale,
      draft_subject: input.draft.subject,
      draft_body: input.draft.bodyText,
      form_url: input.formUrl ?? null,
      status: "queued",
    })
    .select("id,status")
    .single();

  if (error) throw error;
  return { id: data!.id, status: data!.status };
}

/** Claim the oldest queued job (atomic). */
export async function claimNextJob(): Promise<any | null> {
  const sb = srv();
  // Postgres "select for update skip locked" via RPC would be ideal; use simple approach:
  const { data, error } = await sb
    .from("webform_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  const job = data?.[0];
  if (!job) return null;

  const { error: upErr } = await sb
    .from("webform_jobs")
    .update({ status: "running", attempts: (job.attempts ?? 0) + 1 })
    .eq("id", job.id)
    .eq("status", "queued");

  if (upErr) throw upErr;
  return job;
}

export async function completeJobSuccess(jobId: string, args: {
  html?: string;
  screenshotBytesBase64?: string;
  controllerTicketId?: string;
}) {
  const sb = srv();
  const { error } = await sb
    .from("webform_jobs")
    .update({
      status: "success",
      artifact_html: args.html ?? null,
      artifact_screenshot: args.screenshotBytesBase64 ? Buffer.from(args.screenshotBytesBase64, "base64") : null,
      controller_ticket_id: args.controllerTicketId ?? null,
      last_error: null,
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function completeJobFailure(jobId: string, err: unknown) {
  const sb = srv();
  const msg = typeof err === "string" ? err : (err as any)?.message || "unknown_error";
  const { error } = await sb
    .from("webform_jobs")
    .update({
      status: "failed",
      last_error: String(msg),
    })
    .eq("id", jobId);

  if (error) throw error;
}
