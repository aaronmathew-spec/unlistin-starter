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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      status?: string;
      org_id?: string; // optional; cookie takes precedence
    };

    const c = cookies();
    const cookieOrg = c.get("org_id")?.value || null;
    const org_id = cookieOrg || body.org_id || null;

    if (!org_id) {
      return NextResponse.json({ error: "org_id required (select an org first)" }, { status: 400 });
    }

    // Optional: validate membership strictly if caller provides X-User-Id
    const xUserId = req.headers.get("x-user-id") || undefined;
    if (xUserId) {
      const supa = db();
      const { data: ok, error: mErr } = await supa
        .from("user_organizations")
        .select("user_id")
        .eq("user_id", xUserId)
        .eq("org_id", org_id)
        .limit(1);
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
      if (!ok || ok.length === 0) {
        return NextResponse.json({ error: "not a member of this org" }, { status: 403 });
      }
    }

    const supa = db();
    const { data, error } = await supa
      .from("requests")
      .insert([{
        title: (body.title || "").trim() || "Untitled",
        description: (body.description || "").trim() || "",
        status: (body.status || "new"),
        org_id
      } as any])
      .select("id, title, org_id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, request: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "create failed" }, { status: 500 });
  }
}
