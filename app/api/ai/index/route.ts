/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db";
import { embedTexts } from "@/lib/openai";
import { chunkText } from "@/lib/chunk";
import { ensureAiLimit } from "@/lib/ratelimit";

type Body =
  | { reindexAll?: boolean }
  | { kind?: "request" | "file"; id?: number; reindexAll?: boolean };

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

function envBool(v: string | undefined) {
  return v === "1" || v?.toLowerCase() === "true";
}

export async function POST(req: Request) {
  // Feature flag gate
  if (!envBool(process.env.FEATURE_AI_SERVER)) {
    return json(
      { error: "AI server feature is disabled (set FEATURE_AI_SERVER=1 to enable)" },
      { status: 503 }
    );
  }

  // Rate limit
  const rl = await ensureAiLimit(req);
  if (!rl.ok) {
    const nowSec = Math.floor(Date.now() / 1000);
    const retryAfter = Math.max(0, rl.reset - nowSec);
    return json(
      { error: "Rate limit exceeded. Try again shortly.", code: "rate_limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Parse body safely
  let body: Body | undefined;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = undefined;
  }

  const reindexAll = !!(body as any)?.reindexAll;
  const kind =
    (body as any)?.kind === "request" || (body as any)?.kind === "file"
      ? ((body as any).kind as "request" | "file")
      : undefined;
  const id = typeof (body as any)?.id === "number" ? (body as any).id : undefined;

  const db = getSupabaseServer();

  try {
    if (reindexAll) {
      // wipe all my chunks (scoped by RLS) and rebuild from my data
      // fetch minimal fields; adapt columns to your schema
      const [{ data: reqs }, { data: files }] = await Promise.all([
        db.from("requests").select("id,title,description").limit(1000),
        db.from("request_files").select("id,request_id,name,text").limit(2000),
      ]);

      const chunks: {
        kind: "request" | "file";
        ref_id: number;
        index: number;
        text: string;
        file_id?: number | null;
      }[] = [];

      // Requests
      for (const r of reqs || []) {
        const text = [r.title, r.description].filter(Boolean).join("\n\n").trim();
        for (const c of chunkText(text)) {
          chunks.push({ kind: "request", ref_id: r.id, index: c.index, text: c.text });
        }
      }

      // Files (assumes you have a 'text' column already extracted)
      for (const f of files || []) {
        const text = (f as any).text || "";
        for (const c of chunkText(text)) {
          chunks.push({
            kind: "file",
            ref_id: f.request_id,
            index: c.index,
            text: c.text,
            file_id: f.id,
          });
        }
      }

      if (chunks.length === 0) return json({ inserted: 0 });

      // Embed in batches to respect token limits
      const BATCH = 100;
      let inserted = 0;

      // Clean existing chunks (RLS should scope to user)
      await db.from("ai_chunks").delete().neq("id", -1);

      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const vectors = await embedTexts(slice.map((s) => s.text));
        const rows = slice.map((c, idx) => ({
          kind: c.kind,
          ref_id: c.ref_id,
          file_id: c.file_id ?? null,
          chunk_index: c.index,
          content: c.text,
          embedding: vectors[idx] as any, // supabase-js maps pgvector
        }));

        const { error, count } = await db.from("ai_chunks").insert(rows).select("id", { count: "exact" });
        if (error) throw new Error(error.message);
        inserted += (count || rows.length);
      }

      return json({ inserted });
    }

    // Targeted index of one resource
    if (kind && id) {
      let chunks:
        | { kind: "request" | "file"; ref_id: number; index: number; text: string; file_id?: number | null }[]
        | null = null;

      if (kind === "request") {
        const { data, error } = await db.from("requests").select("id,title,description").eq("id", id).single();
        if (error) throw new Error(error.message);
        const text = [data?.title, data?.description].filter(Boolean).join("\n\n").trim();
        chunks = chunkText(text).map((c) => ({
          kind: "request" as const,
          ref_id: id,
          index: c.index,
          text: c.text,
        }));
      } else {
        // file
        const { data, error } = await db.from("request_files").select("id,request_id,name,text").eq("id", id).single();
        if (error) throw new Error(error.message);
        const text = (data as any).text || "";
        chunks = chunkText(text).map((c) => ({
          kind: "file" as const,
          ref_id: data.request_id,
          file_id: data.id,
          index: c.index,
          text: c.text,
        }));
      }

      // delete existing chunks for this entity
      if (kind === "request") {
        await db.from("ai_chunks").delete().eq("kind", "request").eq("ref_id", id);
      } else {
        await db.from("ai_chunks").delete().eq("kind", "file").eq("file_id", id);
      }

      if (!chunks?.length) return json({ inserted: 0 });

      const vectors = await embedTexts(chunks.map((c) => c.text));
      const rows = chunks.map((c, idx) => ({
        kind: c.kind,
        ref_id: c.ref_id,
        file_id: c.file_id ?? null,
        chunk_index: c.index,
        content: c.text,
        embedding: vectors[idx] as any,
      }));
      const { error, count } = await db.from("ai_chunks").insert(rows).select("id", { count: "exact" });
      if (error) throw new Error(error.message);

      return json({ inserted: count || rows.length });
    }

    return json({ error: "Provide {reindexAll:true} or {kind:'request'|'file', id:number}" }, { status: 400 });
  } catch (e: any) {
    return json({ error: e?.message ?? "Indexing failed" }, { status: 500 });
  }
}
