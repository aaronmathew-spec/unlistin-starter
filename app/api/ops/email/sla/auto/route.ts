// app/api/ops/email/sla/auto/route.ts
// Secure, auto follow-up/escalation runner (dry-run by default).
import { NextResponse } from "next/server";
import { runAutoSla } from "@/src/lib/sla/auto";

export const runtime = "nodejs";

function requireCronHeader(req: Request) {
  const secret = process.env.SECURE_CRON_SECRET || "";
  const got = req.headers.get("x-secure-cron") || "";
  if (!secret || got !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const outcome = await runAutoSla({
      limit: typeof body.limit === "number" ? body.limit : undefined,
      controllers: Array.isArray(body.controllers) ? body.controllers : undefined,
      region: typeof body.region === "string" ? body.region : undefined,
      to: body.to as string | string[] | null | undefined,
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
    });

    return NextResponse.json({ ok: true, outcome });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "exception" }, { status: 500 });
  }
}
