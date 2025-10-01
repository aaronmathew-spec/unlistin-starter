// app/api/cron/rescan/route.ts
export const runtime = "nodejs";

import { assertCronAuthorized } from "@/lib/vercel-cron";

/**
 * This route is the daily rescan hook.
 * - Secured by Vercel Cron / CRON_BEARER.
 * - Safe NOOP if FEATURE_AI_SERVER is off.
 * - Drop your real rescan logic into `runDailyRescan()`.
 */

export async function POST(req: Request) {
  // 1) Security
  const forbid = assertCronAuthorized(req);
  if (forbid) return forbid;

  // 2) Feature flag guard
  if (process.env.FEATURE_AI_SERVER !== "1") {
    return Response.json(
      { ok: true, skipped: true, reason: "FEATURE_AI_SERVER is not enabled" },
      { status: 200 }
    );
  }

  try {
    const result = await runDailyRescan();
    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Rescan failed unexpectedly";
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}

async function runDailyRescan() {
  // TODO: Replace with real rescan logic:
  //  - Find stale/failed items
  //  - Requeue processing jobs
  //  - Heal drifted data, rotate evidence, etc.

  // Safe NOOP placeholder
  return { ran: true, requeued: 0, healed: 0 };
}

export const GET = POST;
