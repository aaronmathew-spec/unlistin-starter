// app/api/requests/[id]/files/[fileId]/download/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "request-files";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);
  const fileId = Number(params.fileId);

  // RLS-scoped lookup
  const { data, error } = await supabase
    .from("request_files")
    .select("id, path, name, mime")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "File not found" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.path, 60); // 1-minute link

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: signErr?.message || "Unable to sign URL" }, { status: 400 });
  }

  // Redirect so browser downloads from storage directly
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
