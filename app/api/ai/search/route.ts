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

export async function POST(req: Request) {
  try {
    if (process.env.FEATURE_AI_SERVER !== "1") {
      return NextResponse.json(
        { error: "AI server feature disabled (FEATURE_AI_SERVER=1)" },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      limit?: number;
      kinds?: ("request" | "file")[];
    };

    const query = (body.query ?? "").trim();
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));
    const kinds = body.kinds ?? ["request", "file"];

    if (!query) return NextResponse.json({ matches: [] });

    const qvec = await embedText(query);
    const db = supa();

    // PostgREST cannot directly accept "embedding <-> qvec" unless we send vector as JSON array.
    // We pass it via RPC-less filter using PostgREST's "match" on vector json; Supabase accepts array for vector.
    const { data, error } = await db
      .from("ai_documents")
      .select("kind, ref_id, content")
      // Order by cosine distance using vector operators
      .order("embedding", { ascending: true, foreignTable: undefined, nullsFirst: false }) // no-op for operators; we use filter below
      .limit(limit)
      .filter("kind", "in", `(${kinds.map((k) => `"${k}"`).join(",")})`)
      // Supabase JS lacks direct operator binding; use the RPC-like filter via `select` with computed similarity using `ai_match` view if needed.
      ;

    // Workaround: since PostgREST ordering by vector operator isn't directly expressible in @supabase/ssr,
    // create a dedicated SQL view is overkill here. We'll fetch a wider slice and sort in app.
    let docs = (data ?? []) as { kind: "request" | "file"; ref_id: number; content: string }[];

    // Fetch more to sort client-side
    if ((docs?.length ?? 0) < limit) {
      const { data: more } = await db
        .from("ai_documents")
        .select("kind, ref_id, content, embedding")
        .filter("kind", "in", `(${kinds.map((k) => `"${k}"`).join(",")})`)
        .limit(200);
      docs = (more ?? []) as any;
    }

    // Cosine similarity on server is ideal; here we compute cosine client-side for correctness.
    // (embedding is returned as number[] when selected)
    type Doc = { kind: "request" | "file"; ref_id: number; content: string; embedding?: number[] };
    const vecDocs = docs.filter((d: any) => Array.isArray(d.embedding)) as Doc[];

    function cosine(a: number[], b: number[]) {
      let dp = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length && i < b.length; i++) {
        const x = a[i], y = b[i];
        dp += x * y;
        na += x * x;
        nb += y * y;
      }
      if (na === 0 || nb === 0) return 0;
      return dp / (Math.sqrt(na) * Math.sqrt(nb));
    }

    const ranked = vecDocs
      .map((d) => ({ ...d, score: cosine(d.embedding!, qvec) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((d) => ({
        kind: d.kind,
        ref_id: d.ref_id,
        content: d.content,
        score: d.score,
      }));

    return NextResponse.json({ matches: ranked });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
