// app/api/coverage/[id]/files/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";

const COV_BUCKET = "coverage-files";     // adjust if needed
const COV_TABLE  = "coverage_files";     // columns: id, coverage_id, path, name, mime, size_bytes, created_at

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  cursor: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const coverageId = Number(params.id);
  if (!Number.isFinite(coverageId)) {
    return NextResponse.json({ error: "invalid coverage id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const parsed = ListQuery.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { limit, cursor } = parsed.data;

  let q = supabase
    .from(COV_TABLE)
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

  const list = data ?? [];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ files: list, nextCursor });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const coverageId = Number(params.id);
  if (!Number.isFinite(coverageId)) {
    return NextResponse.json({ error: "invalid coverage id" }, { status: 400 });
  }

  const form = await req.formData();
  const bin = form.get("file");
  if (!(bin instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const mime = (form.get("mime") as string) || (bin as File).type || "application/octet-stream";
  const name = (bin as File).name || `upload-${Date.now()}`;
  const size_bytes = (bin as File).size;

  const ext = name.includes(".") ? name.split(".").pop() : undefined;
  const storageName = `${cryptoRandom()}${ext ? "." + ext : ""}`;
  const storagePath = `${coverageId}/${storageName}`;

  const { error: upErr } = await supabase.storage.from(COV_BUCKET).upload(storagePath, bin, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { data, error } = await supabase
    .from(COV_TABLE)
    .insert({
      coverage_id: coverageId,
      path: storagePath,
      name,
      mime,
      size_bytes,
    })
    .select("id, coverage_id, path, name, mime, size_bytes, created_at")
    .single();

  if (error) {
    await supabase.storage.from(COV_BUCKET).remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivity({
    entity_type: "file",
    entity_id: data.id,
    action: "upload",
    meta: { scope: "coverage", coverage_id: coverageId, name: data.name, mime: data.mime, size_bytes: data.size_bytes },
  });

  return NextResponse.json({ file: data }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const coverageId = Number(params.id);
  if (!Number.isFinite(coverageId)) {
    return NextResponse.json({ error: "invalid coverage id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const fileId = Number(url.searchParams.get("fileId"));
  if (!Number.isFinite(fileId)) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const { data: row, error: getErr } = await supabase
    .from(COV_TABLE)
    .select("id, coverage_id, path, name")
    .eq("id", fileId)
    .eq("coverage_id", coverageId)
    .single();

  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 });

  await supabase.storage.from(COV_BUCKET).remove([row.path]).catch(() => {});
  const { error: delErr } = await supabase.from(COV_TABLE).delete().eq("id", row.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  await logActivity({
    entity_type: "file",
    entity_id: row.id,
    action: "delete",
    meta: { scope: "coverage", coverage_id: coverageId, name: row.name },
  });

  return NextResponse.json({ ok: true, deletedId: row.id });
}

/* utils */
function cryptoRandom() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
