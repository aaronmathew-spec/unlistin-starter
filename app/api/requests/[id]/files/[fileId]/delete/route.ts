// app/api/requests/[id]/files/[fileId]/delete/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; fileId: string } }
) {
  const requestId = Number(params.id);
  const fileId = Number(params.fileId);
  if (!Number.isFinite(requestId) || !Number.isFinite(fileId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Fetch file row under RLS
  const { data: row, error } = await supabase
    .from("request_files")
    .select("id, request_id, path")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try to delete the object first (idempotent if already gone)
  const { error: delObjErr } = await supabase.storage
    .from("request-files")
    .remove([row.path]);

  if (delObjErr) {
    // Storage errors are informative; still try DB delete only if it's a "not found" case
    // Otherwise bail to avoid orphaning
    const msg = delObjErr.message || "Failed to delete storage object";
    if (!/not found/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Delete the DB row (RLS will ensure ownership)
  const { error: dbErr } = await supabase.from("request_files").delete().eq("id", fileId);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
