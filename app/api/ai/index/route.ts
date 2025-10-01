/* eslint-disable @typescript-eslint/no-explicit-any */

// Force Node runtime (embeddings + DB libs prefer Node over Edge)
export const runtime = "nodejs";

import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Chunk = {
  request_id: number | null;
  file_id: number | null;
  kind: "request" | "file";
  ref_id: number;
  content: string;
};

type UpsertRow = {
  request_id: number | null;
  file_id: number | null;
  content: string;
  embedding: number[];
  collection?: string; // defaults in DB to 'product'
};

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

function envBool(v: string | undefined) {
  return v === "1" || v?.toLowerCase() === "true";
}

/** Create a Supabase client (service role if present, else anon). */
function getDB(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

/** Simple paragraph-based chunker. */
function naiveChunk(text: string, target = 800): string[] {
  const parts = text
    .split(/\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    const next = buf ? `${buf}\n\n${p}` : p;
    if (next.length > target && buf) {
      out.push(buf);
      buf = p;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/** Load a single request/file to index. */
async function loadOne(db: SupabaseClient, kind: "request" | "file", id: number): Promise<Chunk[]> {
  if (kind === "request") {
    const { data, error } = await db
      .from("requests")
      .select("id, title, description")
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return [];

    const content = [data.title, data.description].filter(Boolean).join("\n\n").trim();
    if (!content) return [];

    return naiveChunk(content).map((c) => ({
      request_id: data.id,
      file_id: null,
      kind: "request",
      ref_id: data.id,
      content: `# Request ${data.id}${data.title ? ` — ${data.title}` : ""}\n\n${c}`,
    }));
  }

  // kind === "file"
  const { data, error } = await db
    .from("request_files")
    .select("id, request_id, name, text")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return [];

  const content = (data.text || "").trim();
  if (!content) return [];

  return naiveChunk(content).map((c) => ({
    request_id: data.request_id ?? null,
    file_id: data.id,
    kind: "file",
    ref_id: data.id,
    content: `# File ${data.id} — ${data.name}\n\n${c}`,
  }));
}

/** Load a recent window of requests/files. */
async function loadRecent(db: SupabaseClient): Promise<Chunk[]> {
  const { data: reqs, error: rErr } = await db
    .from("requests")
    .select("id, title, description")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (rErr) throw new Error(rErr.message);

  const { data: files, error: fErr } = await db
    .from("request_files")
    .select("id, request_id, name, text")
    .order("created_at", { ascending: false })
    .limit(100);
  if (fErr) throw new Error(fErr.message);

  const chunks: Chunk[] = [];

  for (const r of reqs || []) {
    const content = [r.title, r.description].filter(Boolean).join("\n\n").trim();
    if (!content) continue;
    naiveChunk(content).forEach((c) =>
      chunks.push({
        request_id: r.id,
        file_id: null,
        kind: "request",
        ref_id: r.id,
        content: `# Request ${r.id}${r.title ? ` — ${r.title}` : ""}\n\n${c}`,
      })
    );
  }

  for (const f of files || []) {
    const content = (f.text || "").trim();
    if (!content) continue;
    naiveChunk(content).forEach((c) =>
      chunks.push({
        request_id: f.request_id ?? null,
        file_id: f.id,
        kind: "file",
        ref_id: f.id,
        content: `# File ${f.id} — ${f.name}\n\n${c}`,
      })
    );
  }

  return chunks;
}

export async function POST(req: Request) {
  try {
    if (!envBool(process.env.FEATURE_AI_SERVER)) {
      return json(
        { error: "AI server feature is disabled (set FEATURE_AI_SERVER=1 to enable)" },
        { status: 503 }
      );
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    const db = getDB();
    const body = (await req.json().catch(() => ({}))) as
      | { reindexAll?: boolean }
      | { kind?: "request" | "file"; id?: number; reindexAll?: boolean };

    let chunks: Chunk[] = [];
    if ((body as any).kind && typeof (body as any).id === "number") {
      const { kind, id } = body as { kind: "request" | "file"; id: number };
      chunks = await loadOne(db, kind, id);
    } else {
      chunks = await loadRecent(db);
    }

    if (chunks.length === 0) return json({ inserted: 0, message: "Nothing to index." });

    const openai = new OpenAI({ apiKey });
    const BATCH = 64;
    let inserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const input = slice.map((s) => s.content);

      const emb = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input,
      });

      const vectors = emb.data.map((d) => d.embedding).filter(Array.isArray);

      const rows: UpsertRow[] = slice.map((c, j) => ({
        request_id: c.request_id,
        file_id: c.file_id,
        content: c.content,
        embedding: (vectors[j] as number[]) || [],
      }));

      // NOTE: select() only takes one argument here. Count rows on the client.
      const { data, error } = await db.from("ai_chunks").insert(rows).select("id");
      if (error) throw new Error(error.message);

      inserted += data?.length ?? rows.length;
    }

    return json({ ok: true, inserted });
  } catch (e: any) {
    return json({ error: e?.message ?? "Indexing failed" }, { status: 500 });
  }
}
