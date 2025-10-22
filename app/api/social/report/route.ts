// app/api/social/report/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientIp, rateLimit, tooManyResponse } from "@/lib/rate-limit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

// Tunables for this endpoint
const RL_WINDOW_MS = 60_000; // 1 minute
const RL_MAX = 20;           // 20 reports / minute / IP

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  // ----- Rate limit (per IP) -----
  const ip = getClientIp(req);
  const rl = rateLimit(`social-report:${ip}`, { windowMs: RL_WINDOW_MS, max: RL_MAX, prefix: "api" });
  if (!rl.allowed) return tooManyResponse(rl.remaining, rl.resetMs);

  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let data: any = {};
    if (ct.startsWith("application/json")) {
      data = await req.json();
    } else if (
      ct.startsWith("application/x-www-form-urlencoded") ||
      ct.startsWith("multipart/form-data")
    ) {
      const fd = await req.formData();
      data = Object.fromEntries(fd.entries());
    } else {
      return bad(415, "unsupported_content_type");
    }

    // Basic normalization
    const controller_key = String(data.controller_key || "").trim();
    const platform = String(data.platform || "").trim().toLowerCase();
    const handle = data.handle ? String(data.handle).trim() : null;
    const url = data.url ? String(data.url).trim() : null;
    const reporter_email = data.reporter_email ? String(data.reporter_email).trim() : null;
    const notes = data.notes ? String(data.notes).trim() : null;

    // Very light validation
    if (!controller_key || !platform || (!handle && !url)) {
      return bad(400, "missing_required_fields");
    }
    if (reporter_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reporter_email)) {
      return bad(400, "invalid_email");
    }
    if (url && !/^https?:\/\//i.test(url)) {
      return bad(400, "invalid_url");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
    const { error } = await sb.from("social_reports").insert({
      controller_key,
      platform,
      handle,
      url,
      reporter_email,
      notes,
      status: "new",
    });
    if (error) return bad(400, error.message);

    const res = NextResponse.json({ ok: true });
    // Include RL headers for observability
    res.headers.set("x-ratelimit-remaining", String(rl.remaining));
    res.headers.set("x-ratelimit-reset", String(rl.resetMs));
    return res;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[social.report.error]", String(e?.message || e));
    return bad(500, "internal_error");
  }
}
