// app/api/ops/webform/job/[id]/json/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response(JSON.stringify({ ok: false, error: "env_missing" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const id = (params?.id || "").trim();
  if (!id) {
    return new Response(JSON.stringify({ ok: false, error: "missing_id" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const sb = srv();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  return new Response(JSON.stringify({ ok: true, job: data }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
