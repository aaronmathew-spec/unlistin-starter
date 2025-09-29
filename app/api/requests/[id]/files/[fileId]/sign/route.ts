// app/api/requests/[id]/files/[fileId]/sign/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; fileId: string } }
) {
  const requestId = Number(params.id);
  const fileId = Number(params.fileId);
  if (!Number.isFinite(requestId) || !Number.isFinite(fileId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
  const supabase = createSupabaseServerClient();

  // Select the file row; RLS should ensure only the owner can see it
  const { data: row, error } = await supabase
    .from("request_files")
    .select("id, request_id, path, name")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Sign the storage object path for 5 minutes
  const { data: signed, error: sErr } = await supabase.storage
    .from("request-files")
    .createSignedUrl(row.path, 60 * 5);

  if (sErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: sErr?.message || "Could not sign URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl: signed.signedUrl });
}
