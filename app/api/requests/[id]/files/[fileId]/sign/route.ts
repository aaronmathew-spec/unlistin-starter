// app/api/requests/[id]/files/[fileId]/sign/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "request-files";
const TABLE = "request_files";

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
    .from(TABLE)
    .select("id, request_id, path, name")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: signed, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.path, 300, { download: row.name }); // 5 minutes

  if (urlErr || !signed?.signedUrl) {
    return NextResponse.json({ error: urlErr?.message || "failed to sign url" }, { status: 400 });
  }

  return NextResponse.json({ signedUrl: signed.signedUrl, filename: row.name });
}
