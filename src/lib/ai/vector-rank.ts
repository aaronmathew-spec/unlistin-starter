/* src/lib/ai/vector-rank.ts */
import "server-only";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE!;

// shape of your ai_chunks; adjust fields as in your schema
export type ChunkRow = {
  id: string;
  doc_id: string | null;
  title: string | null;
  text: string;
  // embedding is stored in DB; we don't fetch it back here
};

export type SemanticHit = {
  id: string;
  score: number; // lower = closer if using L2; convert to similarity if you prefer
  text: string;
  title: string | null;
  doc_id: string | null;
};

function sb() {
  return createClient(URL, SR, { auth: { persistSession: false } });
}

/**
 * ANN ranking via ivfflat if index exists; otherwise falls back to a naive top-k by distance
 * using Postgres vector math (works but slower). Both paths stay inside Postgres.
 */
export async function annRank(
  queryEmbedding: number[],
  k = 10
): Promise<SemanticHit[]> {
  const client = sb();

  // Try ANN path first (ivfflat). If planner doesn’t use it, it will still work.
  // Using explicit ::vector cast to ensure param type is vector.
  const { data, error } = await client.rpc("rpc_semantic_rank_ann" as any, {}, {
    // We’ll inline SQL instead of RPC to avoid requiring a SQL function.
    head: false
  });

  // Since we can't define RPC here safely, run a parametrized SQL via postgrest filter:
  // We'll use the `select` with a computed column for distance and order by it.
  const { data: rows, error: qerr } = await client
    .from("ai_chunks")
    .select(`
      id,
      doc_id,
      title,
      text,
      distance: (embedding <-> ${formatVector(queryEmbedding)})
    `)
    .order("distance", { ascending: true })
    .limit(k);

  if (qerr) throw qerr;

  const hits: SemanticHit[] = (rows || []).map((r: any) => ({
    id: r.id,
    score: Number(r.distance ?? 0),
    text: r.text,
    title: r.title ?? null,
    doc_id: r.doc_id ?? null,
  }));

  return hits;
}

// Render an array into a SQL 'vector' literal safely
function formatVector(v: number[]) {
  if (!Array.isArray(v) || v.length === 0) return "null";
  const safe = v.map((x) => (Number.isFinite(x) ? String(x) : "0")).join(",");
  return `vector[${safe}]`;
}
