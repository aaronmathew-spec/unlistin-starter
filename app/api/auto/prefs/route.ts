/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

/**
 * GET  /api/auto/prefs → { ok, prefs }
 * POST /api/auto/prefs { enabled:boolean, scope?:string[] }
 */
export async function GET() {
  const db = supa();
  const { data, error } = await db.from("auto_prefs").select("*").limit(1).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, prefs: data || { enabled: false, scope: [] } });
}

export async function POST(req: Request) {
  let b: any = null;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const enabled = !!b?.enabled;
  const scope = Array.isArray(b?.scope) ? b.scope.slice(0, 64) : [];

  const db = supa();
  // Upsert one row per user; if you later add auth, key on user_id
  const { data, error } = await db
    .from("auto_prefs")
    .upsert({ enabled, scope }, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, prefs: data });
}
