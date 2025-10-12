/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isUUID(s: string | null | undefined) {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      request_id?: string | number; // numeric hint or uuid
      provider?: string;
      within_minutes?: number;
    };

    const db = serverDB();
    let q = db
      .from("otp_codes")
      .select("code, provider, expires_at, source_message_id, created_at, request_id, meta")
      .order("created_at", { ascending: false })
      .limit(1);

    const within = Math.max(0, Math.min(body.within_minutes ?? 30, 720));
    if (within > 0) {
      const sinceISO = new Date(Date.now() - within * 60_000).toISOString();
      q = q.gte("created_at", sinceISO);
    }

    if (body.provider) {
      q = q.eq("provider", body.provider);
    }

    if (body.request_id !== undefined && body.request_id !== null) {
      const rid = String(body.request_id).trim();

      if (isUUID(rid)) {
        // Use strong uuid match
        q = q.eq("request_id", rid);
      } else if (rid.length) {
        // Fallback: match numeric hint stored in meta.correlation_hint
        // Use jsonb @> to match {"correlation_hint":"101"}
        q = q.contains("meta", { correlation_hint: rid });
      }
    }

    const { data, error } = await q.maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: "db read failed", detail: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ code: null });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ code: null, expired: true });
    }

    return NextResponse.json({
      code: data.code,
      provider: data.provider,
      source_message_id: data.source_message_id,
      created_at: data.created_at,
      request_id: data.request_id,
      matched_on: isUUID(String(body.request_id ?? "")) ? "uuid" : "correlation_hint"
    });
  } catch (e: any) {
    console.error("otp.get error", e);
    return NextResponse.json({ error: e?.message ?? "otp get failed" }, { status: 500 });
  }
}
