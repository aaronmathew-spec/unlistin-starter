// app/api/coverage/[id]/files/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "coverage-files";

type FileRow = {
  id: number;
  coverage_id: number;
  path: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const coverageId = Number(params.id);

  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
  const cursor = searchParams.get("cursor");

  let q = supabase
    .from("coverage_files")
    .select("id, coverage_id, path, name, mime, size_bytes, created_at")
    .eq("coverage_id", coverageId)
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const c = Number(cursor);
    if (!Number.isNaN(c)) q = q.lt("id", c);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = (data ?? []) as FileRow[];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ files: list, nextCursor });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const coverageId = Number(params.id);

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

  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  // quick guard: ensure coverage row belongs to user (RLS will also enforce)
  const { data: owned } = await supabase
    .from("coverage")
    .select("id")
    .eq("id", coverageId)
    .limit(1);
  if (!owned || owned.length === 0) {
    return NextResponse.json({ error: "Coverage not found" }, { status: 404 });
  }

  const safeName = sanitizeFileName(file.name || "upload.bin");
  const path = `${coverageId}/${Date.now()}-${safeName}`;

  // 1) Upload to storage
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // 2) Insert row
  const { data, error: insErr } = await supabase
    .from("coverage_files")
    .insert({
      coverage_id: coverageId,
      path,
      name: file.name || safeName,
      mime,
      size_bytes: file.size ?? null,
    })
    .select("id, coverage_id, path, name, mime, size_bytes, created_at")
    .single();

  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ file: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const coverageId = Number(params.id);

  let fileId: number | null = null;
  const url = new URL(req.url);
  const q = url.searchParams.get("fileId");
  if (q) fileId = Number(q);
  if (!fileId) {
    try {
      const body = (await req.json().catch(() => ({}))) as { fileId?: unknown };
      if (body?.fileId) fileId = Number(body.fileId);
    } catch {}
  }
  if (!fileId || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  // Fetch row (RLS)
  const { data: row, error: fe } = await supabase
    .from("coverage_files")
    .select("id, coverage_id, path, name")
    .eq("id", fileId)
    .eq("coverage_id", coverageId)
    .single();

  if (fe || !row) {
    return NextResponse.json({ error: fe?.message || "File not found" }, { status: 404 });
  }

  const { error: stErr } = await supabase.storage.from(BUCKET).remove([row.path]);
  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 403 });

  const { error: delErr } = await supabase
    .from("coverage_files")
    .delete()
    .eq("id", row.id)
    .eq("coverage_id", coverageId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, deletedId: row.id });
}

/* ----------------------------- */
function sanitizeFileName(name: string) {
  const base = name.replace(/[\/\\]+/g, " ").replace(/[\x00-\x1F\x7F]+/g, "");
  const collapsed = base.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, 180) || "file";
}
function clampInt(v: string | null, fallback: number, min: number, max: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
