// src/app/api/ops/controllers/seed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";

type SeedItem = {
  country_code: string;
  region?: string | null;
  site_key: string;
  display_name: string;
  category: string;
  notes?: string | null;
  handlers: Array<{
    channel: "email" | "webform" | "portal" | "api";
    priority?: number;
    endpoint_url?: string | null;
    email_to?: string | null;
    email_subject_template?: string | null;
    meta?: Record<string, any>;
    is_active?: boolean;
  }>;
};

function isAuthorized(req: NextRequest) {
  const hdr = req.headers.get("x-secure-cron") || req.headers.get("x-ops-token");
  const ok =
    (process.env.SECURE_CRON_SECRET && hdr === process.env.SECURE_CRON_SECRET) ||
    (process.env.OPS_DASHBOARD_TOKEN && hdr === process.env.OPS_DASHBOARD_TOKEN);
  return !!ok;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: { controllers: SeedItem[] } | null = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || !Array.isArray(payload.controllers)) {
    return NextResponse.json({ error: "Missing controllers array" }, { status: 400 });
  }

  const s = supabaseAdmin();
  const results: any[] = [];

  for (const c of payload.controllers) {
    // Upsert controller (country + site_key unique-ish pair)
    const { data: existing, error: findErr } = await s
      .from("controllers")
      .select("*")
      .eq("country_code", c.country_code)
      .eq("site_key", c.site_key)
      .limit(1)
      .maybeSingle();

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 });

    let controllerId: string | null = existing?.id ?? null;

    if (!controllerId) {
      const { data: ins, error: insErr } = await s
        .from("controllers")
        .insert({
          country_code: c.country_code,
          region: c.region ?? null,
          site_key: c.site_key,
          display_name: c.display_name,
          category: c.category,
          notes: c.notes ?? null,
          is_active: true
        })
        .select("id")
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      controllerId = ins.id;
    } else {
      await s
        .from("controllers")
        .update({
          region: c.region ?? null,
          display_name: c.display_name,
          category: c.category,
          notes: c.notes ?? null,
          is_active: true
        })
        .eq("id", controllerId);
    }

    // Insert/refresh handlers (simple approach: add if not present by channel+endpoint/email_to)
    for (const h of c.handlers) {
      const { data: hExists, error: hFindErr } = await s
        .from("controller_handlers")
        .select("id")
        .eq("controller_id", controllerId)
        .eq("channel", h.channel)
        .eq("endpoint_url", h.endpoint_url ?? null)
        .eq("email_to", h.email_to ?? null)
        .limit(1)
        .maybeSingle();

      if (hFindErr) return NextResponse.json({ error: hFindErr.message }, { status: 400 });

      if (!hExists) {
        const { error: hInsErr } = await s.from("controller_handlers").insert({
          controller_id: controllerId,
          channel: h.channel,
          priority: h.priority ?? 100,
          endpoint_url: h.endpoint_url ?? null,
          email_to: h.email_to ?? null,
          email_subject_template: h.email_subject_template ?? null,
          meta: h.meta ?? {},
          is_active: h.is_active ?? true
        });
        if (hInsErr) return NextResponse.json({ error: hInsErr.message }, { status: 400 });
      }
    }

    results.push({ controller: `${c.country_code}:${c.site_key}`, handler_count: c.handlers.length });
  }

  return NextResponse.json({ ok: true, upserts: results });
}
