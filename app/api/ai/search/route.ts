/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/db";
import { embedTexts } from "@/lib/openai";
import { ensureSearchLimit } from "@/lib/ratelimit";

type SemanticHit = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  score: number;
  file_id?: number | null;
};

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

export async function POST(req: Request) {
  // Rate limit
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    const nowSec = Math.floor(Date.now() / 1000);
    const retryAfter = Math.max(0, rl.reset - nowSec);
    return json(
      { error: "Rate limit exceeded. Try again shortly.", code: "rate_limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const query = (body?.query ?? "").toString().trim();
  const limit = Math.max(1, Math.min(50, Number(body?.limit ?? 10)));
  const kinds = Array.isArray(body?.kinds) ? (body.kinds as ("request" | "file")[]) : ["request", "file"];

  if (!query) return json({ error: "query is required" }, { status: 400 });

  try {
    const [vector] = await embedTexts([query]);

    const db = getSupabaseServer();

    // We’ll use a SQL filter for kinds and order by distance
    // Note: supabase-js can pass vectors as plain number[] to pgvector column
    let q = db
      .from("ai_chunks")
      .select("kind,ref_id,file_id,content,embedding", { count: "exact" })
      .limit(limit);

    if (kinds?.length === 1) {
      q = q.eq("kind", kinds[0]);
    } else if (kinds?.length === 2) {
      q = q.in("kind", kinds);
    }

    // Order by vector distance (cosine distance)
    // PostgREST needs a `order` with `foreignTable` hack or RPC; but Supabase now supports
    // `order` by `embedding <-> <queryEmbedding>` via the `order` with `nullsFirst/last` disabled.
    // We’ll call an RPC for reliability:

    const { data, error } = await db.rpc("match_ai_chunks", {
      query_embedding: vector as any,
      match_kinds: kinds,
      match_limit: limit,
    });

    if (error) {
      // Fallback: if RPC not created, try simple select without ordering (still returns something)
      const { data: d2, error: e2 } = await q.limit(limit);
      if (e2) throw new Error(e2.message);
      const fallback: SemanticHit[] =
        (d2 || []).map((r: any) => ({
          kind: r.kind,
          ref_id: r.ref_id,
          file_id: r.file_id ?? null,
          content: r.content,
          score: 0.0,
        })) ?? [];
      return json({ matches: fallback, note: "RPC match_ai_chunks missing; returned unordered fallback." });
    }

    const matches: SemanticHit[] = (data || []).map((r: any) => ({
      kind: r.kind,
      ref_id: r.ref_id,
      file_id: r.file_id ?? null,
      content: r.content,
      score: typeof r.similarity === "number" ? r.similarity : r.score ?? 0,
    }));

    return json({ matches });
  } catch (e: any) {
    return json({ error: e?.message ?? "search failed" }, { status: 500 });
  }
}
