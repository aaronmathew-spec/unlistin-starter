/* eslint-disable @typescript-eslint/no-explicit-any */
import { envBool } from "@/lib/env";

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

type Body =
  | { reindexAll?: boolean }
  | { kind?: "request" | "file"; id?: number; reindexAll?: boolean }
  | undefined;

/**
 * Reindex placeholder.
 * - Safe no-op that keeps your UI working while we wire embeddings/pgvector.
 * - When FEATURE_AI_SERVER=1 + OPENAI_API_KEY present, you can progressively
 *   add actual chunking/embedding logic here (or in a cron route).
 */
export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // ignore invalid JSON; treat as empty body
  }

  // Allow no-op success even if the flag is off, to keep UI smooth.
  const serverEnabled = envBool(process.env.FEATURE_AI_SERVER);

  // Safely read reindexAll across the union
  const reindexAll =
    !!body && typeof body === "object" && "reindexAll" in body && body.reindexAll === true;

  if (!serverEnabled) {
    return json({ ok: true, message: "AI server disabled; index is a no-op." });
  }

  if (reindexAll) {
    return json({ ok: true, message: "Reindex requested (placeholder no-op)." });
  }

  // Narrow kind/id using 'in' operator to satisfy TS
  let kind: "request" | "file" | undefined;
  let id: number | undefined;

  if (body && typeof body === "object") {
    if ("kind" in body && (body.kind === "request" || body.kind === "file")) {
      kind = body.kind;
    }
    if ("id" in body && typeof body.id === "number") {
      id = body.id;
    }
  }

  if (kind && id) {
    return json({
      ok: true,
      message: `Reindex ${kind}#${id} requested (placeholder no-op).`,
    });
  }

  return json({ ok: true, message: "No-op index endpoint reached." });
}
