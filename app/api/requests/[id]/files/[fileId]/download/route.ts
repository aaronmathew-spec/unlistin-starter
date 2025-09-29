// app/api/requests/[id]/files/[fileId]/download/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

const BUCKET = "request-files";
const Table = "request_files";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);
  const fileId = Number(params.fileId);
  if (!Number.isFinite(requestId) || !Number.isFinite(fileId)) {
    return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from(Table)
    .select("id, request_id, path, name")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Create short-lived signed URL and redirect (keeps server fast)
  const { data: signed, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.path, 60, { download: row.name });

  if (urlErr || !signed?.signedUrl) {
    return NextResponse.json({ error: urlErr?.message || "failed to sign url" }, { status: 400 });
  }

  // Activity: download
  await logActivity({
    entity_type: "file",
    entity_id: row.id,
    action: "download",
    meta: { scope: "request", request_id: requestId, name: row.name },
  });

  return NextResponse.redirect(signed.signedUrl);
}
