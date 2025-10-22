// src/app/api/ops/controllers/demo-dispatch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chooseHandler } from "@/src/lib/dispatch/choose-handler";

export const runtime = "nodejs";

function authorized(req: NextRequest) {
  const hdr = req.headers.get("x-ops-token");
  return !!(process.env.OPS_DASHBOARD_TOKEN && hdr === process.env.OPS_DASHBOARD_TOKEN);
}

// GET /api/ops/controllers/demo-dispatch?cc=US&site=instagram&subjectId=subj_123
export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const countryCode = (searchParams.get("cc") || "").toUpperCase();
  const siteKey = (searchParams.get("site") || "").toLowerCase();
  const subjectId = searchParams.get("subjectId") || undefined;
  if (!countryCode || !siteKey) {
    return NextResponse.json({ error: "Missing cc or site" }, { status: 400 });
    }

  try {
    const target = await chooseHandler({ subjectId, countryCode, siteKey });
    return NextResponse.json({ ok: true, target });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 400 });
  }
}
