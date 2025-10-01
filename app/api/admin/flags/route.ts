// app/api/admin/flags/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth/rbac";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function GET() {
  const admin = await isAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = supa();
  const { data, error } = await db.from("feature_flags").select("key,value,updated_at").order("key", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, flags: data || [] });
}

export async function PATCH(req: Request) {
  const admin = await isAdmin();
  if (!admin.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const key = (body?.key ?? "").toString().trim();
  const value = body?.value ?? {};

  if (!key) return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 });

  const db = supa();
  const { error } = await db
    .from("feature_flags")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
