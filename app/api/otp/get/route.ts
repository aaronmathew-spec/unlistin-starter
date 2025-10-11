/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      request_id?: string | number; // your app's request id (uuid or number)
      provider?: string;            // optional filter
      within_minutes?: number;      // only return fresh codes
    };

    const db = serverDB();

    let query = db
      .from("otp_codes")
      .select("code, provider, expires_at, source_message_id, created_at, request_id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (body.request_id) {
      query = query.eq("request_id", body.request_id);
    }
    if (body.provider) {
      query = query.eq("provider", body.provider);
    }
    if (body.within_minutes && body.within_minutes > 0) {
      const sinceISO = new Date(Date.now() - body.within_minutes * 60_000).toISOString();
      query = query.gte("created_at", sinceISO);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      return NextResponse.json({ error: "db read failed", detail: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ code: null });
    }

    // If it has an explicit expiry and it's passed, treat as null
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ code: null, expired: true });
    }

    return NextResponse.json({
      code: data.code,
      provider: data.provider,
      source_message_id: data.source_message_id,
      created_at: data.created_at,
      request_id: data.request_id
    });
  } catch (e: any) {
    console.error("otp.get error", e);
    return NextResponse.json({ error: e?.message ?? "otp get failed" }, { status: 500 });
  }
}
