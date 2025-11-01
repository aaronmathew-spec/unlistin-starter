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
  /** Higher = better (normalized similarity) */
  score: number;
};

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

function envBool(v?: string) {
  return v === "1" || v?.toLowerCase() === "true";
}

/** Cosine similarity for in-process fallback */
function cosine(a: number[], b: number[]): number {
  let dp = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dp += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dp / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Convert an L2 distance to a bounded similarity (0..1). */
function l2ToSimilarity(d: number) {
  if (!Number.isFinite(d) || d < 0) return 0;
  return 1 / (1 + d); // monotonic, bounded
}

/** Render an array into a Postgres vector literal for direct SQL selection */
function vectorLiteral(v: number[]) {
  if (!Array.isArray(v) || v.length === 0) return "null";
  const safe = v.map((x) => (Number.isFinite(x) ? String(x) : "0")).join(",");
  // NOTE: PostgREST accepts vector '[...]' form; explicit cast is applied by operator
  return `[${safe}]`;
}

export async function POST(req: Request) {
  try {
    if (!envBool(process.env.FEATURE_AI_SERVER)) {
      return json(
        {
          error:
            "AI server feature is disabled (set FEATURE_AI_SERVER=1 to enable)",
        },
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
      /** Optional: override embedding model */
      model?: string;
    };

    const query = (body.query || "").trim();
    const hardLimit = Math.min(Math.max(body.limit ?? 10, 1), 25); // 1..25
    const filterKinds =
      Array.isArray(body.kinds) && body.kinds.length
        ? new Set(body.kinds)
        : new Set<SemanticHit["kind"]>(["request", "file"]);

    if (!query) return json({ matches: [] });

    // Tenant guard: require org_id cookie
    const orgId = cookies().get("org_id")?.value || null;
    if (!orgId) {
      return json(
        { matches: [], note: "No org selected. Choose an org to search." },
        { status: 200 }
      );
    }

    // Embed the query
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey)
      return json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    const model = (body.model || "text-embedding-3-small").trim();
    const openai = new OpenAI({ apiKey });
    const emb = await openai.embeddings.create({
      model,
      input: query,
    });
    const qvec = (emb.data[0]?.embedding as number[] | undefined) || [];
    if (!qvec.length) return json({ matches: [] });

    // Supabase client (service role to allow server-side search scoped by org)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const db = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // ============================================================
    // 1) Vector SQL via RPC (your existing function), if enabled
    //    RPC must accept org for tenant scoping.
    // ============================================================
    if (envBool(process.env.FEATURE_VECTOR_SQL)) {
      try {
        const { data: matches, error: rpcErr } = await db.rpc(
          "match_ai_chunks",
          {
            query_embedding: qvec as unknown as number[],
            match_count: hardLimit,
            org: orgId,
          }
        );

        if (!rpcErr && Array.isArray(matches)) {
          // We still need request_id/file_id/content to format output.
          const ids = matches
            .map((r: any) => r.id)
            .filter((x: any) => typeof x === "number");
          let rows:
            | Array<{
                id: number;
                request_id: number | null;
                file_id: number | null;
                content: string | null;
              }>
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

            const isFile =
              typeof row.file_id === "number" && row.file_id !== null;
            const kind: SemanticHit["kind"] = isFile ? "file" : "request";
            if (!filterKinds.has(kind)) continue;

            const ref_id = isFile
              ? (row.file_id as number)
              : (row.request_id as number);
            if (typeof ref_id !== "number") continue;

            // If RPC returns l2 distance as `distance`, convert to bounded similarity.
            const score =
              typeof m.distance === "number"
                ? l2ToSimilarity(m.distance)
                : 0;

            out.push({
              kind,
              ref_id,
              content: row.content ?? "",
              score,
            });
          }

          out.sort((a, b) => b.score - a.score);
          return json({ matches: out.slice(0, hardLimit) });
        }
        // Fall through if RPC failed.
      } catch {
        // silent fallthrough
      }
    }

    // ============================================================
    // 2) Vector SQL (DIRECT) without RPC — computed distance column
    //    Toggle with FEATURE_VECTOR_SQL_DIRECT=1
    //    Requires PostgREST to accept computed column expressions.
    // ============================================================
    if (envBool(process.env.FEATURE_VECTOR_SQL_DIRECT)) {
      try {
        // IMPORTANT: we ONLY search current org_id to avoid cross-tenant leakage
        // Select computed distance (embedding <-> [qvec]) and order ASC (closer first)
        const vec = vectorLiteral(qvec);
        const { data: directRows, error: directErr } = await db
          .from("ai_chunks")
          .select(
            `
            id,
            request_id,
            file_id,
            content,
            distance: embedding <-> ${vec}
          `
          )
          .eq("org_id", orgId)
          .order("distance", { ascending: true })
          .limit(hardLimit);

        if (!directErr && Array.isArray(directRows)) {
          const out: SemanticHit[] = [];
          for (const r of directRows as any[]) {
            const isFile =
              typeof r.file_id === "number" && r.file_id !== null;
            const kind: SemanticHit["kind"] = isFile ? "file" : "request";
            if (!filterKinds.has(kind)) continue;

            const ref_id = isFile ? r.file_id : r.request_id;
            if (typeof ref_id !== "number") continue;

            const sim = l2ToSimilarity(Number(r.distance ?? 0));
            out.push({
              kind,
              ref_id,
              content: r.content ?? "",
              score: sim,
            });
          }
          out.sort((a, b) => b.score - a.score);
          return json({ matches: out });
        }
        // Fall through if direct SQL fails (some PostgREST setups disallow expressions).
      } catch {
        // silent fallthrough
      }
    }

    // ============================================================
    // 3) In-process cosine fallback (scoped to org)
    // ============================================================
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

      const score = cosine(qvec, v); // 0..1
      const isFile =
        typeof (r as any).file_id === "number" &&
        (r as any).file_id !== null;
      const kind: SemanticHit["kind"] = isFile ? "file" : "request";
      if (!filterKinds.has(kind)) continue;

      const ref_id = isFile
        ? ((r as any).file_id as number)
        : ((r as any).request_id as number);
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
