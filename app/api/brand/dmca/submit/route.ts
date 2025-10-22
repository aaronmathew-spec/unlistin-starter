// app/api/brand/dmca/submit/route.ts
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
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const body = await req.json().catch(() => null);
  if (!body) return bad(400, "invalid_json");

  const {
    reporter_email,
    reporter_name,
    rights_holder,
    work_description,
    infringement_urls,
    signature_name,
    attestation,
  } = body as {
    reporter_email?: string;
    reporter_name?: string;
    rights_holder?: string;
    work_description?: string;
    infringement_urls?: string[] | string;
    signature_name?: string;
    attestation?: boolean;
  };

  if (!reporter_email || !rights_holder || !work_description || !signature_name || !attestation) {
    return bad(400, "missing_required_fields");
  }

  const urls = Array.isArray(infringement_urls)
    ? infringement_urls
    : typeof infringement_urls === "string" && infringement_urls.trim().length
      ? infringement_urls.split(/\s+/g)
      : [];

  const { data, error } = await sb.from("dmca_requests").insert({
    reporter_email,
    reporter_name: reporter_name || null,
    rights_holder,
    work_description,
    infringement_urls: urls,
    signature_name,
    attestation: !!attestation,
  }).select("id").single();

  if (error) return bad(500, error.message);
  return NextResponse.json({ ok: true, id: data.id });
}
