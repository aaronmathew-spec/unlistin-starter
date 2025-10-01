/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs";

import { cookies } from "next/headers";
import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { ensureAiLimit } from "@/lib/ratelimit";

// If you have a Database type, import it. Using any to keep builds green.
type Database = any;

type Body =
  | { reindexAll?: boolean }
  | { kind?: "request" | "file"; id?: number; reindexAll?: boolean };

function envBool(v: string | undefined) {
  return v === "1" || v?.toLowerCase() === "true";
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

// Supabase server client wired to Next route cookies
function supa() {
  const jar = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (k) => jar.get(k)?.value,
      },
    }
  );
}

async function embedMany(texts: string[], client: OpenAI) {
  if (texts.length === 0) return [];
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return res.data.map((d) => d.embedding as number[]);
}

export async function POST(req: Request) {
  if (!envBool(process.env.FEATURE_AI_SERVER)) {
    return json(
      { error: "AI server feature is disabled (set FEATURE_AI_SERVER=1 to enable)" },
      { status: 503 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json(
      { error: "OPENAI_API_KEY not configured. Set it in your environment." },
      { status: 500 }
    );
  }

  // Rate limit
  const rl = await ensureAiLimit(req);
  if (!rl.ok) {
    return json(
      { error: "Rate limit exceeded. Please try again shortly.", retryAfter: rl.reset },
      { status: 429 }
    );
  }

  // Parse body
  let body: Body = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore
  }

  const db = supa();
  const openai = new OpenAI({ apiKey });

  const reindexAll = (body as any)?.reindexAll === true;
  const targetKind = (body as any)?.kind as "request" | "file" | undefined;
  const targetId = typeof (body as any)?.id === "number" ? (body as any).id : undefined;

  // Collect chunks
  type ChunkInput = { request_id: number; file_id: number | null; content: string };
  const chunks: ChunkInput[] = [];

  const pushReq = (row: { id: number; description: string | null }) => {
    const text = (row.description ?? "").trim();
    if (text) chunks.push({ request_id: row.id, file_id: null, content: text });
  };

  const pushFile = (row: { request_id: number; id: number; name: string | null }) => {
    const text = (row.name ?? "").trim();
    if (text) chunks.push({ request_id: row.request_id, file_id: row.id, content: text });
  };

  try {
    if (reindexAll || (targetKind === "request" && targetId)) {
      if (reindexAll) {
        const { data: reqs, error } = await db
          .from("requests")
          .select("id, description")
          .limit(2000);
        if (error) throw new Error(error.message);
        (reqs ?? []).forEach(pushReq);
      } else if (targetId) {
        const { data: reqs, error } = await db
          .from("requests")
          .select("id, description")
          .eq("id", targetId)
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (reqs) pushReq(reqs);
      }
    }

    if (reindexAll || (targetKind === "file" && targetId)) {
      if (reindexAll) {
        const { data: files, error } = await db
          .from("request_files")
          .select("id, request_id, name")
          .limit(5000);
        if (error) throw new Error(error.message);
        (files ?? []).forEach(pushFile);
      } else if (targetId) {
        const { data: file, error } = await db
          .from("request_files")
          .select("id, request_id, name")
          .eq("id", targetId)
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (file) pushFile(file);
      }
    }

    if (chunks.length === 0) {
      return json({ inserted: 0, message: "Nothing to index." });
    }

    // Embed + insert in batches with strict guards
    const texts = chunks.map((c) => c.content);
    const BATCH = 256;
    let inserted = 0;

    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      const vectors = await embedMany(slice, openai);

      const rows: {
        request_id: number;
        file_id: number | null;
        content: string;
        embedding: number[];
      }[] = [];

      for (let j = 0; j < slice.length; j++) {
        const c = chunks[i + j];
        const v = vectors[j];
        if (!c || !v) continue; // guard against undefined
        rows.push({
          request_id: c.request_id,
          file_id: c.file_id,
          content: c.content,
          embedding: v, // v is guaranteed defined here
        });
      }

      if (rows.length === 0) continue;

      const { error, data } = await db.from("ai_chunks").insert(rows).select("id");
      if (error) throw new Error(error.message);
      inserted += data?.length ?? rows.length;
    }

    return json({ inserted });
  } catch (e: any) {
    return json({ error: e?.message ?? "Index failed" }, { status: 500 });
  }
}
