import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "request-files";

/**
 * GET  /api/requests/[id]/files
 * POST /api/requests/[id]/files
 * DELETE /api/requests/[id]/files   (→ deletes a single file by fileId)
 *
 * NOTE: RLS is enabled per request owner. We rely on that for DB actions.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  const { data, error } = await supabase
    .from("request_files")
    .select("id, request_id, path, name, mime, size_bytes, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ files: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Assuming you already implemented this; keeping a minimal safe version for completeness.
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  // Expecting a FormData upload with file & mime (as you mentioned)
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const mime = (form.get("mime") as string) || file?.type || "application/octet-stream";

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const timestamp = Date.now();
  const path = `${requestId}/${timestamp}-${file.name}`;

  // Upload to storage
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // Insert DB record (RLS enforces that you own the request)
  const { data, error: insErr } = await supabase
    .from("request_files")
    .insert({
      request_id: requestId,
      path,
      name: file.name,
      mime,
      size_bytes: file.size,
    })
    .select("id, request_id, path, name, mime, size_bytes, created_at")
    .single();

  if (insErr) {
    // Attempt cleanup
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ file: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  // Accept ?fileId=... or JSON body { fileId }
  let fileId: number | null = null;
  const url = new URL(req.url);
  const q = url.searchParams.get("fileId");
  if (q) fileId = Number(q);
  if (!fileId) {
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.fileId) fileId = Number(body.fileId);
    } catch {
      /* ignore */
    }
  }
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  // 1) Fetch the file row (RLS ensures you can only see your own)
  const { data: fileRow, error: fetchErr } = await supabase
    .from("request_files")
    .select("id, request_id, path")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (fetchErr || !fileRow) {
    return NextResponse.json({ error: fetchErr?.message || "Not found" }, { status: 404 });
  }

  // 2) Delete from storage first (avoid orphan record if storage policy forbids)
  const { error: stErr } = await supabase.storage.from(BUCKET).remove([fileRow.path]);
  if (stErr) {
    // Common cause: storage RLS not yet configured to allow delete for this user
    return NextResponse.json({ error: stErr.message }, { status: 403 });
  }

  // 3) Delete DB record (RLS will enforce ownership)
  const { error: delErr } = await supabase
    .from("request_files")
    .delete()
    .eq("id", fileId)
    .eq("request_id", requestId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
