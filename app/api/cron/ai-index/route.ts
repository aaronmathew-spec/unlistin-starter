// app/api/cron/ai-index/route.ts
export const runtime = "nodejs";

import { assertCronAuthorized } from "@/lib/vercel-cron";

/**
 * IMPORTANT
 * ---------
 * This route is secure-by-default and build-safe:
 * - Only runs under Vercel Cron (x-vercel-cron: 1) or CRON_BEARER.
 * - If FEATURE_AI_SERVER !== "1", it NOOPs with 200 (never breaks deploys).
 *
 * When you are ready to hook up your actual indexer logic, place it inside
 * the `runAiIndex()` function below. The scaffold is already wired.
 */

export async function POST(req: Request) {
  // 1) Security: only Vercel Cron (or Bearer) can call
  const forbid = assertCronAuthorized(req);
  if (forbid) return forbid;

  // 2) Feature flag guard (keeps prod safe until backend is fully ready)
  if (process.env.FEATURE_AI_SERVER !== "1") {
    return Response.json(
      { ok: true, skipped: true, reason: "FEATURE_AI_SERVER is not enabled" },
      { status: 200 }
    );
  }

  // 3) Parse body (optional; Vercel Cron usually sends no body)
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  try {
    const result = await runAiIndex(body);
    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "AI indexing failed unexpectedly";
    // Return 200 with error payload so the cron doesn't page you constantly
    // (Flip to status 500 if you *want* Vercel Cron to show failures)
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}

/**
 * Put your real indexing logic here.
 * This scaffold intentionally does not import OpenAI or hit your DB so that
 * it never breaks builds. Replace the TODO section with your production code.
 */
async function runAiIndex(body: Record<string, unknown>) {
  // Example accepted payload (optional):
  // { kind: "file" | "request", id: number, reindexAll?: boolean }
  const kind = (body?.kind as string | undefined) ?? "request";
  const id = typeof body?.id === "number" ? (body.id as number) : undefined;
  const reindexAll =
    typeof body?.reindexAll === "boolean" ? (body.reindexAll as boolean) : false;

  // TODO: Replace this stub with your real pipeline.
  //  - Fetch targets (requests/files) that need indexing
  //  - Chunk content
  //  - Create embeddings
  //  - Upsert into your vector table (e.g., ai_chunks)
  //  - Record progress / metrics
  // Make sure to keep it Node runtime-friendly.

  // This is a harmless, production-safe NOOP that proves the route works.
  return {
    ran: true,
    mode: kind,
    id: id ?? null,
    reindexAll,
    processed: 0,
  };
}

// Vercel Cron can also call GET if you prefer; we support both.
export const GET = POST;
