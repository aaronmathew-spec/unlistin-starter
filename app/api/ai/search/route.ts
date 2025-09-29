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

type BodyIn = {
  query?: string;
  limit?: number;
  kinds?: ("request" | "file")[];
};

type DocRow = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  embedding?: number[] | null;
};

function isNumberArray(a: unknown): a is number[] {
  return Array.isArray(a) && a.every((v) => typeof v === "number");
}

// Cosine with total safety (treat any missing entry as 0)
function cosineSafe(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dp = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = typeof a[i] === "number" ? (a[i] as number) : 0;
    const y = typeof b[i] === "number" ? (b[i] as number) : 0;
    dp += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dp / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function POST(req: Request) {
  try {
    if (process.env.FEATURE_AI_SERVER !== "1") {
      return NextResponse.json(
        { error: "AI server feature disabled (FEATURE_AI_SERVER=1)" },
        { status: 503 }
      );
    }

    // Parse and narrow body
    const raw: unknown = await req.json().catch(() => null);
    const body: BodyIn = raw && typeof raw === "object" ? (raw as BodyIn) : {};
    const query = (body.query ?? "").trim();
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));
    const kinds =
      Array.isArray(body.kinds) && body.kinds.length
        ? (body.kinds.filter((k) => k === "request" || k === "file") as ("request" | "file")[])
        : (["request", "file"] as const);

    if (!query) return NextResponse.json({ matches: [] });

    const qvec = await embedText(query);
    const db = supa();

    // Pull a reasonably large slice and rank in-process (RLS enforced).
    // Later we can replace with an SQL view that orders by vector operator.
    const { data, error } = await db
      .from("ai_documents")
      .select("kind, ref_id, content, embedding")
      .filter(
        "kind",
        "in",
        `(${kinds
          .map((k) => `"${k}"`)
          .join(",")})`
      )
      .limit(400);

    if (error) throw new Error(error.message);

    const docs = (data ?? []) as DocRow[];

    const ranked = docs
      .filter((d) => isNumberArray(d.embedding))
      .map((d) => ({
        kind: d.kind,
        ref_id: d.ref_id,
        content: d.content,
        score: cosineSafe(d.embedding as number[], qvec),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({ matches: ranked });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
