// app/api/requests/[id]/files/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";

const BUCKET = "request-files"; // storage bucket name
const Table = "request_files";  // DB table: id, request_id, path, name, mime, size_bytes, created_at

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  cursor: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: "invalid request id" }, { status: 400 });
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
    .from(Table)
    .select("id, request_id, path, name, mime, size_bytes, created_at")
    .eq("request_id", requestId)
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
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: "invalid request id" }, { status: 400 });
  }

  const form = await req.formData();
  const bin = form.get("file");
  if (!(bin instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const mime = (form.get("mime") as string) || bin.type || "application/octet-stream";
  const name = (bin as File).name || `upload-${Date.now()}`;
  const size_bytes = (bin as File).size;

  // Make a unique storage path
  const ext = name.includes(".") ? name.split(".").pop() : undefined;
  const storageName = `${cryptoRandom()}${ext ? "." + ext : ""}`;
  const storagePath = `${requestId}/${storageName}`;

  // Upload to storage (RLS on storage uses policies configured in Supabase)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, bin, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Insert DB row
  const { data, error } = await supabase
    .from(Table)
    .insert({
      request_id: requestId,
      path: storagePath,
      name,
      mime,
      size_bytes,
    })
    .select("id, request_id, path, name, mime, size_bytes, created_at")
    .single();

  if (error) {
    // Best-effort cleanup of the uploaded object if DB insert fails
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Activity: upload
  await logActivity({
    entity_type: "file",
    entity_id: data.id,
    action: "upload",
    meta: { scope: "request", request_id: requestId, name: data.name, mime: data.mime, size_bytes: data.size_bytes },
  });

  return NextResponse.json({ file: data }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: "invalid request id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const fileId = Number(url.searchParams.get("fileId"));
  if (!Number.isFinite(fileId)) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const { data: row, error: getErr } = await supabase
    .from(Table)
    .select("id, request_id, path, name")
    .eq("id", fileId)
    .eq("request_id", requestId)
    .single();

  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 });

  // Remove storage object (ignore if missing)
  await supabase.storage.from(BUCKET).remove([row.path]).catch(() => {});

  const { error: delErr } = await supabase.from(Table).delete().eq("id", row.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // Activity: delete
  await logActivity({
    entity_type: "file",
    entity_id: row.id,
    action: "delete",
    meta: { scope: "request", request_id: requestId, name: row.name },
  });

  return NextResponse.json({ ok: true, deletedId: row.id });
}

/* utils */
function cryptoRandom() {
  // 16 bytes -> 32 hex chars
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
