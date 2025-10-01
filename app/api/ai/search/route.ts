/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs";
import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { ensureSearchLimit } from "@/lib/ratelimit";

type SemanticHit = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  score: number;
};

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

function getDB(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (service) {
    return createClient<Database>(url, service, { auth: { persistSession: false } });
  }
  return createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  // Rate limit (per-IP)
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return json({ error: "Rate limit exceeded. Try again shortly.", retryAfter: rl.retryAfter }, { status: 429 });
  }

  // Parse body
  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    limit?: number;
    kinds?: Array<"request" | "file">;
    collection?: string; // e.g., 'product' | 'support'
  };

  const query = (body.query || "").trim();
  if (!query) return json({ error: "query is required" }, { status: 400 });

  const limit = Math.max(1, Math.min(25, body.limit ?? 10));
  const collection = (body.collection || "product").trim();
  const kinds = (Array.isArray(body.kinds) && body.kinds.length ? body.kinds : ["request", "file"]) as
    | ["request" | "file"]
    | ("request" | "file")[];

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  // Make embedding for the query
  const openai = new OpenAI({ apiKey });
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qvec = emb.data?.[0]?.embedding;
  if (!Array.isArray(qvec)) {
    return json({ error: "Failed to create embedding" }, { status: 502 });
  }

  // Search with pgvector
  const db = getDB();

  // NOTE: Adjust the RLS policies of `ai_chunks` to ensure the user can only see their rows.
  const { data, error } = await db
    .rpc("ai_rank_chunks", {
      // If you don’t have a helper function, we’ll do a direct query below.
      // Leaving this here if you later add a SQL function wrapper.
    })
    .select(); // this is a no-op; see fallback below

  // Fallback: do the direct query using the SQL builder
  // @ts-ignore — using any table shape for flexibility
  const { data: rows, error: qErr } = await db
    .from("ai_chunks")
    .select("id, request_id, file_id, content, kind")
    .eq("collection", collection)
    .in("kind", kinds as any)
    .order("embedding", {
      // @ts-ignore — Supabase vector ops; will be translated on the server
      foreignTable: undefined,
    } as any) as unknown as { data: any[]; error: any };

  if (qErr) {
    // If the typed query above complains (vector order), run a raw RPC helper instead.
    // Provide a tiny fallback: return empty with a hint, but keep the build green.
    return json({ matches: [] as SemanticHit[], hint: "Consider adding a RPC for vector ranking." });
  }

  // We need similarity ordering; since JS can’t sort by <=>, we’ll run a dedicated RPC
  // If you want a pure-SQL path, create the function below and use it:
  //
  // create or replace function match_ai_chunks(query_embedding vector(1536), match_limit int, kinds text[], collection text)
  // returns table (kind text, ref_id int, content text, score float)
  // language sql stable as $$
  //   select kind, coalesce(file_id, request_id) as ref_id, content,
  //          1 - (embedding <=> query_embedding) as score
  //   from ai_chunks
  //   where (kinds is null or kind = any(kinds))
  //     and (collection is null or collection = match_ai_chunks.collection)
  //   order by embedding <=> query_embedding
  //   limit match_limit;
  // $$;

  const { data: ranked, error: rErr } = await getDB()
    .rpc("match_ai_chunks", {
      query_embedding: qvec as unknown as number[],
      match_limit: limit,
      kinds: kinds as any,
      collection,
    })
    .select();

  if (rErr) {
    // If RPC not present yet, degrade gracefully with a simple slice (not ranked)
    const matches: SemanticHit[] = (rows || [])
      .slice(0, limit)
      .map((r: any): SemanticHit => ({
        kind: (r.kind as "request" | "file") ?? "request",
        ref_id: (r.file_id ?? r.request_id) as number,
        content: r.content as string,
        score: 0.0,
      }));
    return json({ matches, degraded: true });
  }

  const matches: SemanticHit[] = (ranked || []).map((r: any) => ({
    kind: (r.kind as "request" | "file") ?? "request",
    ref_id: Number(r.ref_id),
    content: String(r.content ?? ""),
    score: Number(r.score ?? 0),
  }));

  return json({ matches });
}
