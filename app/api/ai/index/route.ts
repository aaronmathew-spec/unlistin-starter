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
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  // If you want this to require the flag, enforce it here.
  // For now we allow no-op success even if the flag is off—to keep the UI smooth.
  const serverEnabled = envBool(process.env.FEATURE_AI_SERVER);
  const reindexAll = body?.reindexAll === true;

  if (!serverEnabled) {
    // Soft success; communicates that nothing actually happened.
    return json({ ok: true, message: "AI server disabled; index is a no-op." });
  }

  // (Future) Insert your real indexing plan here:
  // - Select user-visible requests/files
  // - Chunk text into ~1k tokens
  // - Call OpenAI embeddings
  // - Upsert into ai_chunks (request_id, file_id, chunk_index, content, embedding)
  // - Keep <= N chunks per resource for cost bounds

  if (reindexAll) {
    return json({ ok: true, message: "Reindex requested (placeholder no-op)." });
  }

  // Optional targeting of a single resource
  const kind = (body?.kind === "request" || body?.kind === "file") ? body?.kind : undefined;
  const id = typeof body?.id === "number" ? body?.id : undefined;

  if (kind && id) {
    return json({
      ok: true,
      message: `Reindex ${kind}#${id} requested (placeholder no-op).`,
    });
  }

  return json({ ok: true, message: "No-op index endpoint reached." });
}
