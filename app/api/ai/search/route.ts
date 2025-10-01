// app/api/ai/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSupabase } from "@/lib/supabaseServer";
import { ensureAiLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

type SemanticHit = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  score: number;
};

export async function POST(req: NextRequest) {
  // Rate limit
  const { ok } = await ensureAiLimit(req);
  if (!ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  try {
    const { query, limit = 10 } = (await req.json().catch(() => ({}))) as {
      query?: string;
      limit?: number;
    };

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: "Missing 'query'." },
        { status: 400 }
      );
    }

    // 1) Embed the query
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const emb = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: query.trim(),
    });

    const vector = emb.data?.[0]?.embedding;
    if (!Array.isArray(vector)) {
      return NextResponse.json(
        { error: "Failed to embed query." },
        { status: 500 }
      );
    }

    // 2) Call RPC to perform ANN search (RLS-respecting)
    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc("match_ai_chunks", {
      q: vector as unknown as number[], // supabase-js will map to vector
      match_count: Math.min(Math.max(1, Number(limit) || 10), 50),
    });

    if (error) {
      return NextResponse.json(
        { error: `match_ai_chunks failed: ${error.message}` },
        { status: 500 }
      );
    }

    // 3) Validate & coerce types to our SemanticHit union
    const matches: SemanticHit[] = (data ?? []).map((row: any) => ({
      kind: row.kind === "file" ? "file" : "request",
      ref_id: Number(row.ref_id),
      content: String(row.content ?? ""),
      score: Number(row.score ?? 0),
    }));

    return NextResponse.json({ matches });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
