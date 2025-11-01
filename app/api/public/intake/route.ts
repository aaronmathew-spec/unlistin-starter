// app/api/public/intake/route.ts
/* Minimal public intake endpoint that enqueues a webform job.
   Security:
   - Only enabled when NEXT_PUBLIC_PUBLIC_INTAKE="1"
   - Optional shared secret (PUBLIC_INTAKE_SECRET) via header: x-public-intake
   - Simple size limits + basic input normalization
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ENABLED = (process.env.NEXT_PUBLIC_PUBLIC_INTAKE || "").toLowerCase() === "1";
const SHARED = (process.env.PUBLIC_INTAKE_SECRET || "").trim();
const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    if (!ENABLED) return bad("intake_disabled", 403);
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return bad("env_missing", 500);

    // Optional header secret
    if (SHARED) {
      const hdr = (req.headers.get("x-public-intake") || "").trim();
      if (hdr !== SHARED) return bad("invalid_secret", 403);
    }

    const ct = String(req.headers.get("content-type") || "").toLowerCase();
    let form: FormData | null = null;
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      form = await req.formData();
    } else if (ct.includes("application/json")) {
      const j = await req.json().catch(() => ({}));
      form = new FormData();
      for (const [k, v] of Object.entries(j || {})) form.append(k, String(v ?? ""));
    } else {
      // allow GET-style form posts from <form method="post">
      form = await req.formData().catch(() => null);
    }
    if (!form) return bad("invalid_body");

    const email = String(form.get("email") || "").trim();
    const name = String(form.get("name") || "").trim();
    const url = String(form.get("url") || "").trim();
    const description = String(form.get("description") || "").trim();
    const region = (String(form.get("region") || "IN").trim() || "IN").toUpperCase();

    if (!email || !name || !url) return bad("missing_required_fields");

    // Light validation / size limits
    if (email.length > 200 || name.length > 200 || url.length > 2000 || description.length > 8000) {
      return bad("input_too_large");
    }

    const meta = {
      controllerKey: null,
      controllerName: null,
      subject: { email, name, handle: null, id: null },
      formUrl: url,
      region,
      description,
      source: "public_intake_v1",
      createdBy: "public",
    };

    // Insert a minimal queued job (worker will pick it up based on meta)
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from(TABLE)
      .insert({
        status: "queued",
        url,
        meta,
        error: null,
        result: null,
      } as any)
      .select("id, created_at")
      .single();

    if (error) return bad(`insert_failed:${error.message}`, 500);

    return NextResponse.json({ ok: true, job_id: data?.id, created_at: data?.created_at }, { status: 200 });
  } catch (e: any) {
    return bad(String(e?.message || e || "intake_failed"), 500);
  }
}
