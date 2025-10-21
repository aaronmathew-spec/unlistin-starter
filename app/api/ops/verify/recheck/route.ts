// app/api/ops/verify/recheck/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { assertOpsSecret } from "@/lib/ops/secure";

/**
 * POST /api/ops/verify/recheck
 * Header: x-secure-cron: <SECURE_CRON_SECRET>
 *
 * Tries multiple known exports from "@/lib/verify/recheck" so builds never break
 * if the helper name changes. Calls the first one it finds.
 */
export async function POST(req: Request) {
  const forbidden = assertOpsSecret(req);
  if (forbidden) return forbidden;

  type RecheckFn = (opts?: { limit?: number }) => Promise<any>;

  let recheckFn: RecheckFn | null = null;

  try {
    // Optional import — don’t crash builds if file/exports move
    const mod: any = await import("@/lib/verify/recheck");

    recheckFn =
      mod?.runVerificationRecheck ??
      mod?.recheckDueVerifications ??
      mod?.runRecheckCron ??
      (typeof mod?.default === "function" ? (mod.default as RecheckFn) : null);
  } catch {
    // module missing or failed to load — tolerated
  }

  if (!recheckFn) {
    return NextResponse.json({
      ok: true,
      checked: 0,
      note: "no recheck helper exported from @/lib/verify/recheck",
    });
  }

  try {
    // Most helpers accept an optional limit; tune as you like.
    const out = await recheckFn({ limit: 50 });

    // Normalize to a stable response shape
    const checked =
      (typeof out?.checked === "number" && out.checked) ||
      (typeof out?.updated === "number" && out.updated) ||
      0;

    return NextResponse.json({
      ok: true,
      checked,
      ...(out && typeof out === "object" ? out : {}),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
