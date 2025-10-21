// app/api/ops/logout/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";

const OPS_COOKIE = "ops";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0, // delete
  });
  return res;
}
