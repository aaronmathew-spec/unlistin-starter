import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "request-files";
const EXPIRY_SECONDS = 60; // 1 minute signed URL

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);
  const fileId = Number(params.fileId);

  // 1) Lookup file row; RLS restricts to owner
  const { data: fileRow, error } = await supabase
    .from("request_files")
    .select("id, request_id, path, name, mime")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (error || !fileRow) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  // 2) Create a signed URL
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fileRow.path, EXPIRY_SECONDS, {
      download: fileRow.name, // sets Content-Disposition filename
    });

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: signErr?.message || "Unable to sign URL" }, { status: 400 });
  }

  // 3) Redirect the client to the signed URL (best UX)
  return NextResponse.redirect(signed.signedUrl, 302);
}
