/* eslint-disable @typescript-eslint/no-explicit-any */
import { envBool } from "@/lib/env";
import type { SemanticHit } from "@/types/ai";

export const runtime = "nodejs";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

type Body = {
  query?: string;
  limit?: number;
  kinds?: Array<"request" | "file">;
};

/**
 * Semantic search placeholder.
 * - Always returns a deterministic “demo” match, keeping type-safety intact.
 * - No DB/vector dependency yet; safe to deploy now.
 * - When you wire pgvector, replace the ‘demo’ block with an ANN query on ai_chunks.
 */
export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // keep default
  }

  const query = (body.query ?? "").trim();
  const kinds = (body.kinds && body.kinds.length ? body.kinds : ["request", "file"]) as Array<
    "request" | "file"
  >;
  const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 50);

  // Optionally gate semantic with FEATURE_AI_SERVER (toggle if you prefer strict gating)
  if (!envBool(process.env.FEATURE_AI_SERVER)) {
    // Return empty but valid structure so UI stays green.
    return json({ matches: [] satisfies SemanticHit[] });
  }

  // Placeholder “match” so UI remains useful during rollout.
  const matches: SemanticHit[] =
    query.length === 0
      ? []
      : [
          {
            kind: kinds.includes("request") ? "request" : "file",
            ref_id: kinds.includes("request") ? 123 : 456,
            content:
              "Demo semantic snippet: replace with pgvector ANN results from ai_chunks.content.",
            score: 0.88,
          },
        ];

  return json({ matches: matches.slice(0, limit) });
}
