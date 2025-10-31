// app/api/ops/webform/job/[id]/html/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const sb = srv();
  // result likely contains one of: html | page_html | raw_html
  const { data, error } = await sb
    .from("webform_jobs")
    .select("result")
    .eq("id", id)
    .single();

  if (error || !data) return new Response("not_found", { status: 404 });

  const result = (data as any)?.result || {};
  const html: string =
    result?.html ??
    result?.page_html ??
    result?.raw_html ??
    "";

  if (!html || typeof html !== "string") {
    return new Response("no_html", { status: 404 });
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `inline; filename="webform-${id}.html"`,
    },
  });
}
