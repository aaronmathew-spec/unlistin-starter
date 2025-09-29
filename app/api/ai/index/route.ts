export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { embedText } from "@/lib/embeddings";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

async function upsertRequest(docId: number) {
  const db = supa();

  // Fetch the request row within RLS context to get the owner
  const { data: row, error } = await db
    .from("requests")
    .select("id, title, description, user_id")
    .eq("id", docId)
    .single();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Request not found or not accessible");

  const content = [row.title ?? "", row.description ?? ""].join("\n").trim();
  const textForEmbedding = content || `Request #${row.id}`;
  const vector = await embedText(textForEmbedding);

  const owner = row.user_id ?? null;
  if (!owner) throw new Error("Request missing user_id");

  // Upsert ai_document
  const { error: upErr } = await db
    .from("ai_documents")
    .upsert({
      owner,
      kind: "request",
      ref_id: row.id,
      content: textForEmbedding,
      embedding: vector as unknown as any, // pgvector via PostgREST
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (upErr) throw new Error(upErr.message);

  return { ok: true, kind: "request", id: row.id };
}

async function upsertFile(fileId: number) {
  const db = supa();

  // We only index file name now (no file content extraction yet)
  const { data: f, error } = await db
    .from("request_files")
    .select("id, request_id, name, mime, size_bytes, user_id")
    .eq("id", fileId)
    .single();

  if (error) throw new Error(error.message);
  if (!f) throw new Error("File not found or not accessible");

  const bits = [f.name ?? "", f.mime ?? "", `size:${f.size_bytes ?? "n/a"}`]
    .filter(Boolean)
    .join(" • ");

  const vector = await embedText(bits || `File #${f.id}`);
  const owner = f.user_id ?? null;
  if (!owner) throw new Error("File missing user_id");

  const { error: upErr } = await db
    .from("ai_documents")
    .upsert({
      owner,
      kind: "file",
      ref_id: f.id,
      content: bits || `File #${f.id}`,
      embedding: vector as unknown as any,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (upErr) throw new Error(upErr.message);

  return { ok: true, kind: "file", id: f.id };
}

type IndexBody =
  | { kind?: "request" | "file"; id?: number; reindexAll?: boolean }
  | undefined;

export async function POST(req: Request) {
  try {
    if (process.env.FEATURE_AI_SERVER !== "1") {
      return NextResponse.json(
        { error: "AI server feature disabled (FEATURE_AI_SERVER=1)" },
        { status: 503 }
      );
    }

    // SAFE parse & narrow
    const raw: unknown = await req.json().catch(() => null);
    const body: IndexBody = (raw && typeof raw === "object" ? (raw as any) : undefined) as IndexBody;

    const kind = body?.kind;
    const id = body?.id;
    const reindexAll = body?.reindexAll;

    const db = supa();

    if (reindexAll) {
      // Owner-scoped bulk reindex (safe via RLS)
      // Requests
      const { data: reqs } = await db
        .from("requests")
        .select("id")
        .order("id", { ascending: true })
        .limit(1000);

      const results: any[] = [];
      for (const r of reqs ?? []) {
        try {
          results.push(await upsertRequest(r.id));
        } catch (e: any) {
          results.push({ ok: false, kind: "request", id: r.id, error: e?.message });
        }
      }

      // Files
      const { data: files } = await db
        .from("request_files")
        .select("id")
        .order("id", { ascending: true })
        .limit(2000);

      for (const f of files ?? []) {
        try {
          results.push(await upsertFile(f.id));
        } catch (e: any) {
          results.push({ ok: false, kind: "file", id: f.id, error: e?.message });
        }
      }

      return NextResponse.json({ ok: true, results });
    }

    if (kind === "request" && typeof id === "number") {
      const r = await upsertRequest(id);
      return NextResponse.json(r);
    }
    if (kind === "file" && typeof id === "number") {
      const r = await upsertFile(id);
      return NextResponse.json(r);
    }

    return NextResponse.json(
      { error: "Provide { kind: 'request'|'file', id } or { reindexAll: true }" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
