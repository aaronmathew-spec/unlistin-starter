// app/api/ops/login/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const OPS_COOKIE = "ops";
const MAX_AGE = 60 * 60 * 8; // 8h session

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = process.env.OPS_DASHBOARD_TOKEN || "";

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "OPS_DASHBOARD_TOKEN is not configured" },
      { status: 500 }
    );
  }

  if (!body?.token || body.token !== token) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true, // important on Vercel (HTTPS)
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
