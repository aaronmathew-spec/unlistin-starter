// app/api/me/organizations/route.ts
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

/** GET /api/me/organizations — returns orgs current user belongs to. */
export async function GET() {
  try {
    const db = supa();
    const { data: userData, error: uerr } = await db.auth.getUser();
    if (uerr || !userData?.user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

    const { data, error } = await db
      .from("org_memberships")
      .select("orgs:org_id ( id, name )");

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const orgs = (data || [])
      .map((row: any) => row.orgs)
      .filter(Boolean)
      .map((o: any) => ({ id: o.id, name: o.name }));

    return NextResponse.json({ ok: true, orgs });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unexpected error" }, { status: 500 });
  }
}
