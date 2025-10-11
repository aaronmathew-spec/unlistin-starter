/* eslint-disable @typescript-eslint/no-explicit-any */

// Force Node runtime (embeddings + DB libs prefer Node over Edge)
export const runtime = "nodejs";

import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** OPTIONAL extractors (only used when a file payload is provided in the request) */
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { htmlToText } from "html-to-text";

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

/** OPTIONAL: extract text from a file buffer if the client provided file payload */
async function extractTextFromBuffer(mime: string, buf: Buffer): Promise<string> {
  const mt = mime.toLowerCase();

  if (mt.includes("pdf")) {
    const out = await pdf(buf);
    return (out.text || "").trim();
  }
  if (mt.includes("word") || mt.includes("docx") || mt.includes("officedocument.wordprocessingml")) {
    const out = await mammoth.extractRawText({ buffer: buf });
    return (out.value || "").trim();
  }
  if (mt.includes("html") || mt.includes("htm")) {
    const html = buf.toString("utf8");
    return htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: "script,style,noscript", format: "skip" },
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      ],
    }).trim();
  }

  // fallback to utf8 text
  return buf.toString("utf8").trim();
}

/** Load a single request/file to index (DB-source). */
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

/** Load a recent window of requests/files (DB-source). */
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
      | {
          kind?: "request" | "file";
          id?: number;
          reindexAll?: boolean;
          /** OPTIONAL: if you call this route with a file payload, we’ll extract text server-side */
          file?: { name: string; type: string; dataBase64: string };
        };

    let chunks: Chunk[] = [];

    // OPTIONAL: if a file payload is provided for a single file, prefer extracting that content
    if (body && (body as any).kind === "file" && typeof (body as any).id === "number" && (body as any).file) {
      const { id, file } = body as { id: number; file: { name: string; type: string; dataBase64: string } };
      const buf = Buffer.from(file.dataBase64, "base64");
      const text = (await extractTextFromBuffer(file.type, buf)) || "";

      if (text.trim().length > 0) {
        naiveChunk(text).forEach((c) =>
          chunks.push({
            request_id: null, // we don't know request mapping from raw upload; your caller can pass it if needed
            file_id: id,
            kind: "file",
            ref_id: id,
            content: `# File ${id} — ${file.name}\n\n${c}`,
          })
        );
      }
    }

    // If not provided, or after optional extraction, fall back to your existing DB-loads
    if (chunks.length === 0) {
      if ((body as any).kind && typeof (body as any).id === "number") {
        const { kind, id } = body as { kind: "request" | "file"; id: number };
        chunks = await loadOne(db, kind, id);
      } else {
        chunks = await loadRecent(db);
      }
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

      const { data, error } = await db.from("ai_chunks").insert(rows).select("id");
      if (error) throw new Error(error.message);

      inserted += data?.length ?? rows.length;
    }

    return json({ ok: true, inserted });
  } catch (e: any) {
    return json({ error: e?.message ?? "Indexing failed" }, { status: 500 });
  }
}
