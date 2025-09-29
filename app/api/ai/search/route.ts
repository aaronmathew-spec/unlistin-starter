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

export async function POST(req: Request) {
  try {
    if (process.env.FEATURE_AI_SERVER !== "1") {
      return NextResponse.json(
        { error: "AI server feature disabled (FEATURE_AI_SERVER=1)" },
        { status: 503 }
      );
    }

    // Parse and narrow
    const raw: unknown = await req.json().catch(() => null);
    const body: BodyIn = raw && typeof raw === "object" ? (raw as BodyIn) : {};
    const query = (body.query ?? "").trim();
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));
    const kinds =
      Array.isArray(body.kinds) && body.kinds.length
        ? (body.kinds.filter((k) => k === "request" || k === "file") as ("request" | "file")[])
        : (["request", "file"] as const);

    if (!query) return NextResponse.json({ matches: [] });

    // Embed the query
    const qvec = await embedText(query);

    // Call RPC that ranks in-DB (fast + respects RLS)
    const db = supa();
    // Supabase can pass numeric arrays and cast to vector implicitly for RPC.
    const { data, error } = await db.rpc("match_ai_documents", {
      qvec: qvec as unknown as any, // Supabase will map number[] -> vector
      kinds,
      limit_count: limit,
    });

    if (error) {
      return NextResponse.json(
        { error: `match_ai_documents failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Data rows already sorted by similarity descending (we returned 1 - distance as 'score')
    const matches =
      (data as { kind: "request" | "file"; ref_id: number; content: string; score: number }[]) ??
      [];

    return NextResponse.json({ matches });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
