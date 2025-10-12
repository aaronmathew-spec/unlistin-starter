/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { cookies } from "next/headers";

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
    if (!envBool(process.env.FEATURE_AI_SERVER)) {
      return json(
        { error: "AI server feature is disabled (set FEATURE_AI_SERVER=1 to enable)" },
        { status: 503 }
      );
    }

    // Rate limit
    const rl = await ensureSearchLimit(req);
    if (!rl.ok) {
      return json(
        {
          error: "Rate limit exceeded. Try again shortly.",
          code: "rate_limited",
          reset: rl.reset,
          remaining: rl.remaining,
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

    // 0) Require org_id from cookie to avoid cross-tenant leaks
    const orgId = cookies().get("org_id")?.value || null;
    if (!orgId) {
      return json({ matches: [], note: "No org selected. Choose an org to search." }, { status: 200 });
    }

    // 1) Embed the query
    const openai = new OpenAI({ apiKey });
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const qvec = emb.data[0]?.embedding as number[] | undefined;
    if (!qvec) return json({ matches: [] });

    // Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // =========================
    // Safe pgvector RPC path (only if RPC accepts org)
    // =========================
    if (envBool(process.env.FEATURE_VECTOR_SQL)) {
      try {
        // Use the RPC that supports org filtering.
        const { data: matches, error: rpcErr } = await db.rpc("match_ai_chunks", {
          query_embedding: qvec as unknown as number[],
          match_count: hardLimit,
          org: orgId,
        });

        if (!rpcErr && Array.isArray(matches)) {
          // We still need request_id/file_id to decide `kind` and `ref_id`:
          const ids = matches.map((r: any) => r.id).filter((x: any) => typeof x === "number");
          let rows:
            | Array<{ id: number; request_id: number | null; file_id: number | null; content: string }>
            | [] = [];

          if (ids.length > 0) {
            const { data: got } = await db
              .from("ai_chunks")
              .select("id, request_id, file_id, content")
              .in("id", ids)
              .eq("org_id", orgId);
            rows = (got as any[]) || [];
          }

          const byId = new Map(rows.map((r) => [r.id, r]));
          const out: SemanticHit[] = [];
          for (const m of matches as any[]) {
            const row = byId.get(m.id);
            if (!row) continue;

            const isFile = typeof row.file_id === "number" && row.file_id !== null;
            const kind: SemanticHit["kind"] = isFile ? "file" : "request";
            if (!filterKinds.has(kind)) continue;

            const ref_id = isFile ? (row.file_id as number) : (row.request_id as number);
            if (typeof ref_id !== "number") continue;

            // If RPC returns cosine distance, invert to similarity-ish
            const score =
              typeof m.distance === "number" ? 1 - Math.min(Math.max(m.distance, 0), 1) : 0;

            out.push({
              kind,
              ref_id,
              content: row.content ?? m.content ?? "",
              score,
            });
          }

          out.sort((a, b) => b.score - a.score);
          return json({ matches: out.slice(0, hardLimit) });
        }
        // If RPC failed, fall through to in-process path below.
      } catch {
        // silent fallthrough
      }
    }

    // =========================
    // In-process cosine path (scoped to org)
    // =========================
    const { data: rows, error } = await db
      .from("ai_chunks")
      .select("id, request_id, file_id, content, embedding")
      .eq("org_id", orgId)
      .order("id", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    if (!rows?.length) return json({ matches: [] });

    const scored: SemanticHit[] = [];
    for (const r of rows) {
      const v = (r as any).embedding as number[] | undefined;
      if (!Array.isArray(v) || v.length === 0) continue;

      const score = cosine(qvec, v);
      const isFile = typeof (r as any).file_id === "number" && (r as any).file_id !== null;
      const kind: SemanticHit["kind"] = isFile ? "file" : "request";
      if (!filterKinds.has(kind)) continue;

      const ref_id = isFile ? ((r as any).file_id as number) : ((r as any).request_id as number);
      if (typeof ref_id !== "number") continue;

      scored.push({
        kind,
        ref_id,
        content: (r as any).content ?? "",
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const matches = scored.slice(0, hardLimit);
    return json({ matches });
  } catch (e: any) {
    return json({ error: e?.message ?? "Semantic search failed" }, { status: 500 });
  }
}
