/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false } }
  );
}

/**
 * POST /api/org/ensure-personal
 * Body: { user_id: string, full_name?: string, email?: string }
 * - Creates "<full_name || email || 'Personal'> (Personal)" org if user has no memberships.
 * - Adds (user_id, org_id, 'owner') in user_organizations (idempotent).
 * - Sets org_id cookie so the app immediately scopes to it.
 */
export async function POST(req: NextRequest) {
  try {
    const { user_id, full_name, email } = (await req.json().catch(() => ({}))) as {
      user_id?: string;
      full_name?: string;
      email?: string;
    };
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const supa = db();

    // 1) If user already has at least one org, reuse the latest membership
    const { data: memberships, error: mErr } = await supa
      .from("user_organizations")
      .select("org_id")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    let orgId: string | null = memberships?.[0]?.org_id ?? null;

    // 2) Otherwise create a personal org and add membership
    if (!orgId) {
      const displayName =
        (full_name && full_name.trim()) ||
        (email && email.split("@")[0]!) ||
        "Personal";
      const personalName = `${displayName} (Personal)`;

      // create org if not exists by name (no ON CONFLICT needed)
      const { data: existed } = await supa
        .from("organizations")
        .select("id")
        .eq("name", personalName)
        .limit(1);

      if (existed && existed.length) {
        orgId = existed[0]!.id;
      } else {
        const { data: ins, error: oErr } = await supa
          .from("organizations")
          .insert([{ name: personalName }])
          .select("id")
          .maybeSingle();
        if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
        orgId = ins?.id ?? null;
      }

      if (!orgId) return NextResponse.json({ error: "failed to create personal org" }, { status: 500 });

      // add membership (idempotent)
      const { error: uoErr } = await supa
        .from("user_organizations")
        .insert([{ user_id, org_id: orgId, role: "owner" }])
        .select("user_id")
        .maybeSingle();
      if (uoErr && !uoErr.message.includes("duplicate key")) {
        // tolerate duplicates; otherwise fail
        return NextResponse.json({ error: uoErr.message }, { status: 500 });
      }
    }

    // 3) Set current org cookie
    const res = NextResponse.json({ ok: true, org_id: orgId });
    if (orgId) {
      res.cookies.set({
        name: "org_id",
        value: orgId,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "ensure-personal failed" }, { status: 500 });
  }
}
