/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const sb = srv();
  const { data, error } = await sb
    .from(TABLE)
    .select("id,status,error,result,created_at,claimed_at,finished_at,worker_id")
    .eq("id", id)
    .single();

  if (error || !data) return new Response("not_found", { status: 404 });

  return new Response(JSON.stringify({ ok: true, job: data }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="webform-job-${encodeURIComponent(id)}.json"`,
    },
  });
}
