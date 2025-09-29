export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { queueIndex } from "@/lib/ai/indexQueue";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 100);
    const cursor = url.searchParams.get("cursor");

    const requestId = Number(ctx.params.id);
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = supa();
    let q = db
      .from("request_files")
      .select("id, request_id, name, mime, size_bytes, created_at, path")
      .eq("request_id", requestId);

    if (cursor) {
      const c = Number(cursor);
      if (Number.isFinite(c)) {
        q = q.gt("id", c); // ascending keyset
      }
    }

    q = q.order("id", { ascending: true }).limit(limit);

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as {
      id: number;
      request_id: number;
      name: string;
      mime: string | null;
      size_bytes: number | null;
      created_at: string;
      path?: string | null;
    }[];

    const nextCursor = rows.length === limit ? String(rows[rows.length - 1]!.id) : null;

    return NextResponse.json({ files: rows, nextCursor });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const requestId = Number(ctx.params.id);
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const db = supa();

    // 1) Create a DB row to get the file id
    const { data: inserted, error: insErr } = await db
      .from("request_files")
      .insert({
        request_id: requestId,
        name: file.name || "upload",
        mime: file.type || "application/octet-stream",
        size_bytes: file.size ?? null,
      })
      .select("id, name")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    const fileId = inserted?.id as number;

    // 2) Upload to storage at a deterministic path
    const ext = (inserted?.name?.split(".").pop() || "").toLowerCase();
    const path = `${requestId}/${fileId}${ext ? "." + ext : ""}`;

    const arrayBuf = await file.arrayBuffer();
    const { error: upErr } = await db.storage
      .from("request-files")
      .upload(path, new Uint8Array(arrayBuf), {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (upErr) {
      // best-effort: clean DB row if storage failed
      try {
        await db.from("request_files").delete().eq("id", fileId);
      } catch {}
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // 3) Save path back to the row
    const { error: updErr } = await db
      .from("request_files")
      .update({ path })
      .eq("id", fileId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // 4) Fire-and-forget AI index for the file
    if (fileId) queueIndex("file", fileId);

    return NextResponse.json({ ok: true, id: fileId, path });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
