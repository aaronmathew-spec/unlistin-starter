// src/lib/webform/dao.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/src/lib/supabase/admin";

export type WebformJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  subject_id: string;
  url: string;
  meta: Record<string, any> | null;
  attempts: number;
  error: string | null;
  result: Record<string, any> | null;
  created_at: string;
  claimed_at: string | null;
  finished_at: string | null;
  worker_id: string | null;

  controller_key?: string | null;
  controller_name?: string | null;
  subject_name?: string | null;
  subject_email?: string | null;
  subject_phone?: string | null;
  subject_handle?: string | null;
};

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

export async function listWebformJobs(opts?: {
  status?: string;
  limit?: number;
}) {
  const s = supabaseAdmin();
  const limit = Math.max(1, Math.min(Number(opts?.limit ?? 200), 1000));
  let q = s
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.status) {
    q = q.eq("status", opts.status);
  }

  const { data, error } = await q;
  if (error) throw new Error(`listWebformJobs: ${error.message}`);
  return (data || []) as WebformJob[];
}

export async function getWebformCounts() {
  const s = supabaseAdmin();
  async function count(status?: string) {
    let q = s.from(TABLE).select("id", { count: "exact", head: true });
    if (status) q = q.eq("status", status);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
  const [queued, running, failed, succeeded, total] = await Promise.all([
    count("queued"),
    count("running"),
    count("failed"),
    count("succeeded"),
    count(undefined),
  ]);
  return { queued, running, failed, succeeded, total };
}

/** Requeue a job: set status=queued, clear claimed/finished/error (leave attempts as-is). */
export async function requeueJob(id: string) {
  const s = supabaseAdmin();
  const { error } = await s
    .from(TABLE)
    .update({
      status: "queued",
      claimed_at: null,
      finished_at: null,
      worker_id: null,
      error: null,
    })
    .eq("id", id);
  if (error) throw new Error(`requeueJob: ${error.message}`);
  return { ok: true };
}

/** Cancel a job by marking failed with an error message. */
export async function cancelJob(id: string, reason = "cancelled_by_operator") {
  const s = supabaseAdmin();
  const { error } = await s
    .from(TABLE)
    .update({
      status: "failed",
      error: reason,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`cancelJob: ${error.message}`);
  return { ok: true };
}
