// app/api/ops/webform/job/[id]/html/route.ts
// Serves captured HTML from webform_jobs.result.html (if present)

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase/admin";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const id = decodeURIComponent(ctx.params.id);
  const s = supabaseAdmin();

  const { data, error } = await s
    .from(TABLE)
    .select("result")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const result = (data as any)?.result || null;
  const html: string | undefined = result?.html || result?.HTML || undefined;

  if (!html) {
    return NextResponse.json({ ok: false, error: "no_html" }, { status: 404 });
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
