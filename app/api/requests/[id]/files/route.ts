// app/api/requests/[id]/files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "request-files";

/**
 * GET    /api/requests/[id]/files?limit=20&cursor=123
 * POST   /api/requests/[id]/files    (FormData: file, mime?)
 * DELETE /api/requests/[id]/files?fileId=123  (or JSON: { fileId })
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
  const cursor = searchParams.get("cursor");

  let q = supabase
    .from("request_files")
    .select("id, request_id, path, name, mime, size_bytes, created_at")
    .eq("request_id", requestId)
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const cursorId = Number(cursor);
    if (!Number.isNaN(cursorId)) q = q.lt("id", cursorId);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const nextCursor =
    data && data.length === limit ? String(data[data.length - 1].id) : null;

  return NextResponse.json({ files: data ?? [], nextCursor });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  const mime =
    (form.get("mime") as string) ||
    (file?.type && String(file.type)) ||
    "application/octet-stream";

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const safeName = sanitizeFileName(file.name || "upload.bin");
  const path = `${requestId}/${Date.now()}-${safeName}`;

  // Upload to Storage
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Insert DB row
  const { data, error: insErr } = await supabase
    .from("request_files")
    .insert({
      request_id: requestId,
      path,
      name: file.name || safeName,
      mime,
      size_bytes: file.size ?? null,
    })
    .select("id, request_id, path, name, mime, size_bytes, created_at")
    .single();

  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // Log activity (best-effort)
  await supabase.from("request_activity").insert({
    request_id: requestId,
    type: "file_uploaded",
    message: `File uploaded: ${data.name}`,
    meta: {
      file_id: data.id,
      path: data.path,
      mime: data.mime,
      size_bytes: data.size_bytes,
    },
  });

  return NextResponse.json({ file: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

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
  if (!fileId || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  // Fetch the row (RLS enforces ownership)
  const { data: fileRow, error: fetchErr } = await supabase
    .from("request_files")
    .select("id, request_id, path, name, mime, size_bytes")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (fetchErr || !fileRow) {
    return NextResponse.json(
      { error: fetchErr?.message || "File not found" },
      { status: 404 }
    );
  }

  // Delete from storage
  const { error: stErr } = await supabase.storage.from(BUCKET).remove([fileRow.path]);
  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 403 });

  // Delete DB row
  const { error: delErr } = await supabase
    .from("request_files")
    .delete()
    .eq("id", fileId)
    .eq("request_id", requestId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // Log activity (best-effort)
  await supabase.from("request_activity").insert({
    request_id: requestId,
    type: "file_deleted",
    message: `File deleted: ${fileRow.name}`,
    meta: {
      file_id: fileRow.id,
      path: fileRow.path,
      mime: fileRow.mime,
      size_bytes: fileRow.size_bytes,
    },
  });

  return NextResponse.json({ ok: true, deletedId: fileId });
}

/* ----------------------------- helpers ----------------------------- */

function sanitizeFileName(name: string) {
  const base = name.replace(/[\/\\]+/g, " ").replace(/[\x00-\x1F\x7F]+/g, "");
  const collapsed = base.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, 180) || "file";
}

function clampInt(
  val: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(val);
  if (Number.isFinite(n)) {
    return Math.max(min, Math.min(max, Math.floor(n)));
  }
  return fallback;
}
