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

  // Optional columns some code may read directly
  controller_key?: string | null;
  controller_name?: string | null;
  subject_name?: string | null;
  subject_email?: string | null;
  subject_handle?: string | null;

  [key: string]: any;
};

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const MAX_ATTEMPTS = Number(process.env.WEBFORM_MAX_ATTEMPTS ?? 3);

type MaybeStr = string | null | undefined;

/** Extended args: accept richer fields and fold them into meta */
export type EnqueueArgs = {
  // Optional (derive from subject.id if missing)
  subjectId?: MaybeStr;
  // Optional (derive from formUrl if missing)
  url?: MaybeStr;

  meta?: Record<string, any>;
  controllerKey?: MaybeStr;
  controllerName?: MaybeStr;
  subject?: {
    name?: MaybeStr;
    email?: MaybeStr;
    phone?: MaybeStr;
    handle?: MaybeStr;
    id?: MaybeStr;
  };
  locale?: MaybeStr;
  draft?: { subject?: MaybeStr; bodyText?: MaybeStr };
  formUrl?: MaybeStr;

  // allow future extras without type errors
  [key: string]: any;
};

// Safely remove null/undefined from shallow objects
function clean(obj: unknown): Record<string, any> {
  const o: Record<string, any> = (obj ?? {}) as Record<string, any>;
  const out: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/**
 * Enqueue a webform job into Supabase.
 * Accepts a rich input and merges known fields into meta.
 * Returns the inserted job id so callers can log / branch on it.
 */
export async function enqueueWebformJob(args: EnqueueArgs): Promise<{ id: string }> {
  const s = supabaseAdmin();

  const {
    subjectId,
    url,
    meta,
    controllerKey,
    controllerName,
    subject,
    locale,
    draft,
    formUrl,
    ...rest
  } = args;

  // Derive required DB fields (never insert nulls)
  const resolvedSubjectId =
    (subjectId ?? subject?.id ?? null) ? String(subjectId ?? subject?.id) : crypto.randomUUID();

  const resolvedUrl =
    (url ?? formUrl ?? null) ? String(url ?? formUrl) : "https://google.com/";

  const mergedMeta: Record<string, any> = {
    ...clean(meta),
    ...clean({
      controllerKey,
      controllerName,
      subject: subject ? clean(subject) : undefined,
      locale,
      draft: draft ? clean(draft) : undefined,
      formUrl,
    }),
  };

  if (Object.keys(rest).length) {
    mergedMeta._extra = { ...(mergedMeta._extra || {}), ...clean(rest) };
  }

  // Insert and return the created row's id
  const { data, error } = await s
    .from(TABLE)
    .insert({
      status: "queued",
      subject_id: resolvedSubjectId,
      url: resolvedUrl,
      meta: mergedMeta,
      attempts: 0,
      error: null,
      result: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`enqueueWebformJob: ${error.message}`);
  return { id: (data as any).id as string };
}

/** Claim the next queued job (race-safe best effort). */
export async function claimNextJob(): Promise<WebformJob | null> {
  const s = supabaseAdmin();

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
  if (!claimed || claimed.status !== "running") return null;

  return claimed;
}

/** Mark job succeeded with small result payload. */
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

/** Mark job failure; re-queue if attempts remain. */
export async function completeJobFailure(jobId: string, errMsg: string, attemptsSoFar?: number) {
  const s = supabaseAdmin();

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
