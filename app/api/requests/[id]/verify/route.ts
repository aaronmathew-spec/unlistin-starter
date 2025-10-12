/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id; // may be uuid or numeric hint
    const { within_minutes } = (await req.json().catch(() => ({}))) as {
      within_minutes?: number;
    };

    // ask our /api/otp/get for a fresh code
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${base}/api/otp/get`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: id, within_minutes: within_minutes ?? 30 }),
    });
    const j = await res.json().catch(() => ({}));
    const code = j?.code || null;
    if (!code) return NextResponse.json({ ok: false, verified: false, reason: "no_otp" });

    // mark request as verified
    const db = serverDB();
    const { error } = await db.from("requests").update({ status: "verified" } as any).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, verified: true, code });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "verify failed" }, { status: 500 });
  }
}
