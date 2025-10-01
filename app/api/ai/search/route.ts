// app/api/ai/search/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** What the client (app/ai/page.tsx) expects back from this API. */
type SemanticHit = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  score: number;
};

type RequestBody = {
  query?: string;
  limit?: number;
  kinds?: Array<"request" | "file">;
};

/**
 * POST /api/ai/search
 * Body: { query: string, limit?: number, kinds?: ("request"|"file")[] }
 * Resp: { matches: SemanticHit[] } | { error: string }
 */
export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // keep body as {}
  }

  const query = (body.query ?? "").toString().trim();
  const limit =
    typeof body.limit === "number" && body.limit > 0 && body.limit <= 50
      ? Math.floor(body.limit)
      : 10;

  const kinds =
    Array.isArray(body.kinds) && body.kinds.length
      ? (body.kinds.filter((k): k is "request" | "file" => k === "request" || k === "file"))
      : (["request", "file"] as const);

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  // -----------------------------
  // TODO: Replace this stub with real pgvector search against ai_chunks.
  // This placeholder keeps builds green while we ship the UI.
  // -----------------------------
  const demo: SemanticHit[] = [
    {
      kind: "request",
      ref_id: 123,
      content: `Demo semantic explanation for "${query}" found in a request.`,
      score: 0.92,
    },
    {
      kind: "file",
      ref_id: 456,
      content: `Demo semantic snippet for "${query}" found in a file.`,
      score: 0.87,
    },
  ]
    .filter((m) => kinds.includes(m.kind))
    .slice(0, limit);

  return NextResponse.json({ matches: demo });
}

/** Hint for accidental GETs */
export async function GET() {
  return NextResponse.json(
    { error: "Use POST with JSON body: { query, limit?, kinds? }" },
    { status: 405 }
  );
}
