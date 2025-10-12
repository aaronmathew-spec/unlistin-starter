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

/**
 * POST /api/otp/wait
 * Body:
 *  - request_id: string | number  (e.g., "101" or a UUID)
 *  - provider?: "justdial" | "indiamart" | "generic"
 *  - within_minutes?: number  // lookback window (default 30)
 *  - timeout_ms?: number      // max wait (default 20000ms)
 *  - poll_interval_ms?: number (default 2000ms)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      request_id?: string | number;
      provider?: string;
      within_minutes?: number;
      timeout_ms?: number;
      poll_interval_ms?: number;
    };

    const reqId = body.request_id === undefined ? "" : String(body.request_id).trim();
    const within = Math.max(1, Math.min(body.within_minutes ?? 30, 720));
    const timeout = Math.max(1000, Math.min(body.timeout_ms ?? 20000, 90000));
    const interval = Math.max(500, Math.min(body.poll_interval_ms ?? 2000, 10000));
    const sinceISO = new Date(Date.now() - within * 60_000).toISOString();

    const db = serverDB();

    const attempt = async () => {
      let q = db
        .from("otp_codes")
        .select("code, provider, expires_at, source_message_id, created_at, request_id, meta")
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(1);

      if (body.provider) q = q.eq("provider", body.provider);

      if (reqId) {
        if (isUUID(reqId)) {
          q = q.eq("request_id", reqId);
        } else {
          q = q.contains("meta", { correlation_hint: reqId });
        }
      }

      const { data, error } = await q.maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
      return data;
    };

    const started = Date.now();
    while (Date.now() - started < timeout) {
      const got = await attempt();
      if (got) {
        return NextResponse.json({
          code: got.code,
          provider: got.provider,
          created_at: got.created_at,
          request_id: got.request_id,
          matched_on: isUUID(reqId) ? "uuid" : "correlation_hint",
        });
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    return NextResponse.json({ code: null, timeout_ms: timeout });
  } catch (e: any) {
    console.error("otp.wait error", e);
    return NextResponse.json({ error: e?.message ?? "otp wait failed" }, { status: 500 });
  }
}
