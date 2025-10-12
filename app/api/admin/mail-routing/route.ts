/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const { data, error } = await db()
    .from("mail_routing")
    .select("id, to_address, org_id, organizations!inner(id, name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    to_address: r.to_address,
    org_id: r.org_id,
    org_name: r.organizations?.name ?? "(unknown)"
  }));
  return NextResponse.json({ routes: rows });
}

export async function POST(req: NextRequest) {
  const { to_address, org_id } = (await req.json().catch(() => ({}))) as {
    to_address?: string; org_id?: string;
  };
  if (!to_address?.trim() || !org_id) {
    return NextResponse.json({ error: "to_address and org_id required" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("mail_routing")
    .insert([{ to_address: to_address.trim(), org_id }])
    .select("id, to_address, org_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, route: data });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: number };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db().from("mail_routing").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
