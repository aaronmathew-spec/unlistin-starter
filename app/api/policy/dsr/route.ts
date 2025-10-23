// app/api/policy/dsr/route.ts
import { NextResponse } from "next/server";
import { DSR_MATRIX, resolvePolicyByRegion } from "@/lib/policy/dsr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = url.searchParams.get("region");
  if (!region) {
    return NextResponse.json({ ok: true, matrix: DSR_MATRIX });
  }
  const policy = resolvePolicyByRegion(region);
  if (!policy) {
    return NextResponse.json({ ok: false, error: "unknown_region" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, policy });
}
