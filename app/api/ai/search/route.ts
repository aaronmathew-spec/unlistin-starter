/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs";

import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

export async function POST(req: Request) {
  // Rate limiting (per-IP)
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return json(
      { error: "Rate limit exceeded. Try again shortly.", retryAfter: rl.retryAfter },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    limit?: number;
    kinds?: Array<"request" | "file">;
    collection?: string;
  };

  const query = (body.query || "").trim();
  if (!query) return json({ error: "query is required" }, { status: 400 });

  const limit = Math.max(1, Math.min(25, body.limit ?? 10));
  const collection = (body.collection || "product").trim();
  const kinds =
    (Array.isArray(body.kinds) && body.kinds.length ? body.kinds : ["request", "file"]) as
      | ["request" | "file"]
      | ("request" | "file")[];

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  // Create embedding for the query
  const openai = new OpenAI({ apiKey });
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qvec = emb.data?.[0]?.embedding;
  if (!Array.isArray(qvec)) {
    return json({ error: "Failed to create embedding" }, { status: 502 });
  }

  const db = getDB();

  // Preferred: use an RPC for ranked search (pgvector)
  const { data: ranked, error: rErr } = (await db
    .rpc("match_ai_chunks", {
      query_embedding: qvec as unknown as number[],
      match_limit: limit,
      kinds: kinds as any,
      collection,
    })
    .select()) as unknown as { data: any[] | null; error: any | null };

  if (!rErr && Array.isArray(ranked)) {
    const matches: SemanticHit[] = ranked.map((r: any) => ({
      kind: (r.kind as "request" | "file") ?? "request",
      ref_id: Number(r.ref_id),
      content: String(r.content ?? ""),
      score: Number(r.score ?? 0),
    }));
    return json({ matches });
  }

  // Fallback (no RPC yet): simple non-ranked slice from the table
  const { data: rows, error: qErr } = (await db
    .from("ai_chunks")
    .select("id, request_id, file_id, content, kind")
    .eq("collection", collection)
    .in("kind", kinds as any)
    .limit(limit)) as unknown as { data: any[] | null; error: any | null };

  if (qErr) {
    // Keep builds green; return an empty set with a hint
    return json({ matches: [] as SemanticHit[], degraded: true, hint: "Add match_ai_chunks RPC." });
  }

  const matches: SemanticHit[] = (rows || []).map((r) => ({
    kind: (r.kind as "request" | "file") ?? "request",
    ref_id: (r.file_id ?? r.request_id) as number,
    content: r.content as string,
    score: 0.0,
  }));
  return json({ matches, degraded: true });
}
