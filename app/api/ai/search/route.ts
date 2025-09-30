// app/api/ai/search/route.ts
export const runtime = "nodejs";

type SearchRequest = {
  q?: string;
  limit?: number;
};

type SearchHit = {
  id: string;
  source: "request" | "file";
  title: string;
  snippet: string;
  score: number;
};

type SearchResponse =
  | { ok: true; results: SearchHit[] }
  | { ok: false; error: string };

export async function POST(req: Request) {
  // Feature-gated: keep deploys safe until backend is ready
  if (process.env.FEATURE_AI_SERVER !== "1") {
    const safe: SearchResponse = { ok: true, results: [] };
    return Response.json(safe, { status: 200 });
  }

  // Parse body safely
  const body = (await req.json().catch(() => ({}))) as SearchRequest;
  const q = (body.q ?? "").toString().trim();
  const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 50);

  // Minimal input validation
  if (!q) {
    const resp: SearchResponse = { ok: true, results: [] };
    return Response.json(resp, { status: 200 });
  }

  // TODO: Replace this stub with your real vector search (ai_chunks table)
  // This placeholder ensures builds never break and lets the UI ship now.
  const demo: SearchHit[] = [
    {
      id: "demo-1",
      source: "request",
      title: `Demo match for "${q}"`,
      snippet:
        "This is a placeholder search result. Wire it to your ai_chunks vector index to return real matches.",
      score: 0.42,
    },
  ].slice(0, limit);

  const ok: SearchResponse = { ok: true, results: demo };
  return Response.json(ok, { status: 200 });
}

export const GET = POST;
