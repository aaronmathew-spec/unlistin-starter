/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth";

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

// GET: list all adapter controls
export async function GET() {
  if (!(await isAdmin())) return json({ ok: false, error: "Not found" }, { status: 404 });
  const db = supa();
  const { data, error } = await db.from("adapter_controls").select("*").order("adapter_id");
  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, rows: data || [] });
}

// POST: upsert a control row { adapter_id, killed?, daily_cap?, min_confidence? }
export async function POST(req: Request) {
  if (!(await isAdmin())) return json({ ok: false, error: "Not found" }, { status: 404 });
  const db = supa();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const adapter_id = (body?.adapter_id || "").toLowerCase();
  if (!adapter_id) return json({ ok: false, error: "Missing adapter_id" }, { status: 400 });

  const patch: any = { adapter_id };
  if (typeof body.killed === "boolean") patch.killed = body.killed;
  if (Number.isFinite(body.daily_cap)) patch.daily_cap = Math.max(0, Math.min(1000, body.daily_cap));
  if (Number.isFinite(body.min_confidence))
    patch.min_confidence = Math.max(0.5, Math.min(0.99, Number(body.min_confidence)));

  const { data, error } = await db
    .from("adapter_controls")
    .upsert(patch, { onConflict: "adapter_id" })
    .select("*")
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: data });
}
