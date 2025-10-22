// app/api/social/report/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return bad(500, "supabase_env_missing");

  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let data: Record<string, any> = {};

    if (ct.startsWith("application/json")) {
      data = (await req.json()) ?? {};
    } else if (
      ct.startsWith("application/x-www-form-urlencoded") ||
      ct.startsWith("multipart/form-data")
    ) {
      const fd = await req.formData();
      data = Object.fromEntries(fd.entries());
    } else {
      return bad(415, "unsupported_content_type");
    }

    const controller_key = String(data.controller_key || "").trim();
    const platform = String(data.platform || "").trim().toLowerCase();
    const handle = data.handle ? String(data.handle).trim() : null;
    const url = data.url ? String(data.url).trim() : null;
    const reporter_email = data.reporter_email ? String(data.reporter_email).trim() : null;
    const notes = data.notes ? String(data.notes).trim() : null;

    if (!controller_key || !platform || (!handle && !url)) {
      return bad(400, "missing_required_fields");
    }

    // Simple platform allowlist (extend as needed)
    const allowed = new Set(["twitter", "x", "instagram", "facebook", "reddit", "youtube", "tiktok", "linkedin"]);
    if (!allowed.has(platform)) {
      // still accept but normalize common alias
      if (platform === "x") data.platform = "twitter";
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: inserted, error } = await sb
      .from("social_reports")
      .insert({
        controller_key,
        platform: data.platform || platform,
        handle,
        url,
        reporter_email,
        notes,
        status: "new",
      })
      .select("id")
      .single();

    if (error) return bad(400, error.message);
    return NextResponse.json({ ok: true, id: inserted?.id ?? null });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[social.report.error]", String(e?.message || e));
    return bad(500, "internal_error");
  }
}
