// app/api/leaks/ingest/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const SECURE_TOKEN = (process.env.SECURE_CRON_SECRET || "").trim(); // reuse secure token for ingestion

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return bad(500, "supabase_env_missing");
  if (!SECURE_TOKEN) return bad(500, "secure_token_missing");

  const header = (req.headers.get("x-secure-cron") || "").trim();
  if (header !== SECURE_TOKEN) return bad(403, "forbidden");

  const body = await req.json().catch(() => null);
  if (!body) return bad(400, "invalid_json");

  const { source, url, indicator, severity, fingerprint } = body as {
    source?: string; url?: string; indicator?: string; severity?: string; fingerprint?: string;
  };

  if (!source || !url) return bad(400, "source_url_required");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const { data, error } = await sb.from("leak_events").insert({
    source,
    url,
    indicator: indicator || null,
    severity: severity || "medium",
    fingerprint: fingerprint || null,
  }).select("id").single();

  if (error) return bad(500, error.message);
  return NextResponse.json({ ok: true, id: data.id });
}
