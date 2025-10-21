// app/api/ops/login/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const OPS_COOKIE = "ops";
const MAX_AGE = 60 * 60 * 8; // 8h session

export async function POST(req: Request) {
  // Tolerate bad/empty JSON bodies
  const body = (await req.json().catch(() => ({}))) as { token?: string | null };

  const configured = (process.env.OPS_DASHBOARD_TOKEN || "").trim();
  if (!configured) {
    return NextResponse.json(
      { ok: false, error: "OPS_DASHBOARD_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const provided = (body?.token || "").trim();
  if (!provided || provided !== configured) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  // Create secure cookie. (We store the token itself to match your existing middleware.)
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE, configured, {
    httpOnly: true,
    sameSite: "lax",
    secure: true, // HTTPS on Vercel
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
