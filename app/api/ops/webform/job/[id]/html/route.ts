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

/**
 * Returns the captured HTML for a given job id, if present.
 * We look for either:
 *   - webform_jobs.artifact_html (preferred if you’ve added this column)
 *   - webform_jobs.result.html (fallback; what the worker stores today)
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }

  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const sb = srv();

  // Select potential sources. If artifact_html doesn’t exist in your schema,
  // Supabase will just omit it from the row; the fallback below will still work.
  const { data, error } = await sb
    .from("webform_jobs")
    .select("artifact_html, result")
    .eq("id", id)
    .single();

  if (error || !data) return new Response("not_found", { status: 404 });

  // Prefer dedicated artifact column; else fall back to result.html
  const artifactHtml = (data as any)?.artifact_html;
  const resultHtml = (data as any)?.result?.html;

  const html =
    typeof artifactHtml === "string"
      ? artifactHtml
      : typeof resultHtml === "string"
      ? resultHtml
      : null;

  if (!html) return new Response("no_html", { status: 404 });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
