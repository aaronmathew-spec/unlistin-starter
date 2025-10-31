// src/lib/webform/list.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";
const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

function admin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export type WebformJobRow = {
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
  subject_handle?: string | null;
};

export async function listWebformJobs(limit = 200): Promise<WebformJobRow[]> {
  const s = admin();
  const { data, error } = await s
    .from(TABLE)
    .select(
      `id,status,subject_id,url,meta,attempts,error,result,created_at,claimed_at,finished_at,worker_id,
       controller_key,controller_name,subject_name,subject_email,subject_handle`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listWebformJobs: ${error.message}`);
  return (data ?? []) as WebformJobRow[];
}

export async function getWebformJob(id: string): Promise<WebformJobRow | null> {
  const s = admin();
  const { data, error } = await s
    .from(TABLE)
    .select(
      `id,status,subject_id,url,meta,attempts,error,result,created_at,claimed_at,finished_at,worker_id,
       controller_key,controller_name,subject_name,subject_email,subject_handle`
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(`getWebformJob: ${error.message}`);
  }
  return (data ?? null) as WebformJobRow | null;
}
