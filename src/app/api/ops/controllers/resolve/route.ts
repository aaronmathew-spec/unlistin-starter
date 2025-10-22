// src/app/api/ops/controllers/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveHandler } from "@/src/lib/controllers/resolve";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest) {
  const hdr = req.headers.get("x-ops-token");
  return !!(process.env.OPS_DASHBOARD_TOKEN && hdr === process.env.OPS_DASHBOARD_TOKEN);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return new NextResponse("Forbidden", { status: 403 });
  const { searchParams } = new URL(req.url);
  const countryCode = (searchParams.get("cc") || "").toUpperCase();
  const siteKey = (searchParams.get("site") || "").toLowerCase();
  const subjectId = searchParams.get("subjectId") || undefined;

  if (!countryCode || !siteKey) {
    return NextResponse.json({ error: "Missing cc or site" }, { status: 400 });
  }

  const resolved = await resolveHandler({ subjectId, countryCode, siteKey });
  return NextResponse.json({ ok: !!resolved, resolved });
}
