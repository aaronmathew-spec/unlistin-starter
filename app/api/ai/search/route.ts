/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
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

function envBool(v?: string) {
  return v === "1" || v?.toLowerCase() === "true";
}

function cosine(a: number[], b: number[]): number {
  let dp = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i]!, y = b[i]!;
    dp += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dp / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function POST(req: Request) {
  try {
    // Feature flag — if you ever want to hide this endpoint
    if (!envBool(process.env.FEATURE_AI_SERVER)) {
      return json(
        { error: "AI server feature is disabled (set FEATURE_AI_SERVER=1 to enable)" },
        { status: 503 }
      );
    }

    // Rate limit
    const rl = await ensureSearchLimit(req);
    if (!rl.ok) {
      // No `retryAfter` on your limiter — expose reset epoch instead
      return json(
        {
          error: "Rate limit exceeded. Try again shortly.",
          code: "rate_limited",
          reset: rl.reset,         // epoch ms when the window resets
          remaining: rl.remaining, // 0
        },
        { status: 429 }
      );
    }

    // Parse body
    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      limit?: number;
      kinds?: ("request" | "file")[];
    };

    const query = (body.query || "").trim();
    const hardLimit = Math.min(Math.max(body.limit ?? 10, 1), 25); // 1..25
    const filterKinds =
      Array.isArray(body.kinds) && body.kinds.length
        ? new Set(body.kinds)
        : new Set<SemanticHit["kind"]>(["request", "file"]);

    if (!query) return json({ matches: [] });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    // 1) Embed the query
    const openai = new OpenAI({ apiKey });
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const qvec = emb.data[0]?.embedding as number[] | undefined;
    if (!qvec) return json({ matches: [] });

    // 2) Pull a recent window from ai_chunks (keeps this endpoint simple & portable)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // grab latest 200 chunks; adjust if you like
    const { data: rows, error } = await db
      .from("ai_chunks")
      .select("id, request_id, file_id, content, embedding")
      .order("id", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    if (!rows?.length) return json({ matches: [] });

    // 3) Score by cosine similarity in-process (no pgvector SQL needed)
    const scored: SemanticHit[] = [];
    for (const r of rows) {
      const v = (r as any).embedding as number[] | undefined;
      if (!Array.isArray(v) || v.length === 0) continue;

      const score = cosine(qvec, v);
      const isFile = typeof r.file_id === "number" && r.file_id !== null;
      const isReq = typeof r.request_id === "number" && r.request_id !== null;

      const kind: SemanticHit["kind"] = isFile ? "file" : "request";
      if (!filterKinds.has(kind)) continue;

      const ref_id = isFile ? (r.file_id as number) : (r.request_id as number);
      if (typeof ref_id !== "number") continue;

      scored.push({
        kind,
        ref_id,
        content: r.content ?? "",
        score,
      });
    }

    // 4) Return top-N
    scored.sort((a, b) => b.score - a.score);
    const matches = scored.slice(0, hardLimit);

    return json({ matches });
  } catch (e: any) {
    return json({ error: e?.message ?? "Semantic search failed" }, { status: 500 });
  }
}
