// src/lib/webform/queue.ts
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
};

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const MAX_ATTEMPTS = Number(process.env.WEBFORM_MAX_ATTEMPTS ?? 3);

/**
 * Enqueue a webform job into Supabase (preferred).
 * If you previously posted directly to the worker endpoint, this replaces that with a durable queue.
 */
export async function enqueueWebformJob(args: { subjectId: string; url: string; meta?: Record<string, any> }) {
  const s = supabaseAdmin();
  const { error } = await s.from(TABLE).insert({
    status: "queued",
    subject_id: args.subjectId,
    url: args.url,
    meta: args.meta ?? {},
    attempts: 0,
    error: null,
    result: null,
  });
  if (error) throw new Error(`enqueueWebformJob: ${error.message}`);
}

/**
 * Claim the next queued job atomically (best-effort, race-safe).
 * Strategy: select oldest queued/retryable, then update to running iff still queued.
 */
export async function claimNextJob(): Promise<WebformJob | null> {
  const s = supabaseAdmin();

  // Pick the oldest job that's queued and still below max attempts
  const { data: candidates, error: selErr } = await s
    .from(TABLE)
    .select("*")
    .in("status", ["queued"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(1);

  if (selErr) throw new Error(`claimNextJob.select: ${selErr.message}`);
  const job = (candidates?.[0] as WebformJob | undefined) ?? null;
  if (!job) return null;

  const workerId = crypto.randomUUID();

  // Try to claim it by transitioning from queued -> running
  const { data: updData, error: updErr } = await s
    .from(TABLE)
    .update({
      status: "running",
      attempts: job.attempts + 1,
      claimed_at: new Date().toISOString(),
      worker_id: workerId,
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("*")
    .limit(1);

  if (updErr) throw new Error(`claimNextJob.update: ${updErr.message}`);

  const claimed = (updData?.[0] as WebformJob | undefined) ?? null;
  // If someone else grabbed it between select and update, try again next tick.
  if (!claimed || claimed.status !== "running") return null;

  return claimed;
}

/**
 * Mark job as succeeded and attach a small result payload (e.g., screenshot IDs).
 */
export async function completeJobSuccess(jobId: string, result?: Record<string, any>) {
  const s = supabaseAdmin();
  const { error } = await s
    .from(TABLE)
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      result: result ?? {},
      error: null,
    })
    .eq("id", jobId);
  if (error) throw new Error(`completeJobSuccess: ${error.message}`);
}

/**
 * Mark job failure. If attempts left, re-queue, otherwise fail.
 */
export async function completeJobFailure(jobId: string, errMsg: string, attemptsSoFar?: number) {
  const s = supabaseAdmin();

  // Fetch current attempts if not provided
  let attempts = attemptsSoFar ?? 0;
  if (attemptsSoFar == null) {
    const { data, error } = await s.from(TABLE).select("attempts").eq("id", jobId).single();
    if (error) throw new Error(`completeJobFailure.select: ${error.message}`);
    attempts = (data as any)?.attempts ?? 0;
  }

  const now = new Date().toISOString();
  const retry = attempts < MAX_ATTEMPTS;

  const { error: updErr } = await s
    .from(TABLE)
    .update({
      status: retry ? "queued" : "failed",
      error: errMsg,
      finished_at: retry ? null : now,
    })
    .eq("id", jobId);

  if (updErr) throw new Error(`completeJobFailure.update: ${updErr.message}`);
}
