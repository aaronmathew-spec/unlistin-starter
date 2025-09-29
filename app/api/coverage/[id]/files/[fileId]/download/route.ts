// app/api/coverage/[id]/files/[fileId]/download/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

const COV_BUCKET = "coverage-files";
const COV_TABLE  = "coverage_files";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const supabase = createSupabaseServerClient();
  const coverageId = Number(params.id);
  const fileId = Number(params.fileId);
  if (!Number.isFinite(coverageId) || !Number.isFinite(fileId)) {
    return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from(COV_TABLE)
    .select("id, coverage_id, path, name")
    .eq("id", fileId)
    .eq("coverage_id", coverageId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: signed, error: urlErr } = await supabase.storage
    .from(COV_BUCKET)
    .createSignedUrl(row.path, 60, { download: row.name });

  if (urlErr || !signed?.signedUrl) {
    return NextResponse.json({ error: urlErr?.message || "failed to sign url" }, { status: 400 });
  }

  await logActivity({
    entity_type: "file",
    entity_id: row.id,
    action: "download",
    meta: { scope: "coverage", coverage_id: coverageId, name: row.name },
  });

  return NextResponse.redirect(signed.signedUrl);
}
