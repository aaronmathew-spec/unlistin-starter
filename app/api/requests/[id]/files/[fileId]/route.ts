export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * DELETE /api/requests/[id]/files/[fileId]
 * Steps:
 * 1) Load the file row under RLS
 * 2) Delete storage object
 * 3) Delete DB row
 * 4) Delete ai_documents row (kind='file', ref_id=fileId) if exists
 *
 * All steps are best-effort; we try to keep state consistent.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: { id: string; fileId: string } }
) {
  try {
    const requestId = Number(ctx.params.id);
    const fileId = Number(ctx.params.fileId);
    if (!Number.isFinite(requestId) || !Number.isFinite(fileId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = supa();

    // 1) Load row (RLS)
    const { data: row, error: selErr } = await db
      .from("request_files")
      .select("id, request_id, path")
      .eq("id", fileId)
      .eq("request_id", requestId)
      .single();

    if (selErr || !row) {
      return NextResponse.json(
        { error: selErr?.message || "File not found" },
        { status: 404 }
      );
    }

    // 2) Delete storage object (best effort)
    if (row.path) {
      const { error: stErr } = await db.storage
        .from("request-files")
        .remove([row.path]);
      // Ignore stErr; proceed to delete DB row. You could bail out if you want strict behavior.
    }

    // 3) Delete DB row
    const { error: delErr } = await db
      .from("request_files")
      .delete()
      .eq("id", fileId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    // 4) Delete ai_documents entry (best effort; respects RLS on ai_documents)
    try {
      await db
        .from("ai_documents")
        .delete()
        .match({ kind: "file", ref_id: fileId });
    } catch {
      // ignore cleanup errors
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
