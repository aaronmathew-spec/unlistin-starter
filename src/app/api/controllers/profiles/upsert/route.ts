// src/app/api/controllers/profiles/upsert/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Schema = z.object({
  controllerId: z.string().uuid().optional(),
  domain: z.string().toLowerCase().optional(),
  fieldSelectors: z.record(z.array(z.string())).optional(),
  submitSelectors: z.array(z.string()).optional(),
  captcha: z
    .object({
      type: z.enum(["recaptcha_v2", "recaptcha_v3", "hcaptcha"]).nullable().optional(),
      sitekey: z.string().nullable().optional(),
      widgetSelector: z.string().nullable().optional(),
    })
    .optional(),
  throttleMs: z.number().int().positive().max(10000).optional(),
  notes: z.string().optional(),
}).refine(
  (d) => d.controllerId || d.domain,
  { message: "Either controllerId or domain is required" }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = Schema.parse(body);

    // Require authenticated user (same pattern as others)
    const supa = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supa.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Upsert by controllerId or domain
    const match =
      input.controllerId != null
        ? { controller_id: input.controllerId }
        : { domain: input.domain!.toLowerCase() };

    const payload: any = {
      ...match,
      field_selectors: input.fieldSelectors ?? undefined,
      submit_selectors: input.submitSelectors ?? undefined,
      captcha: input.captcha ?? undefined,
      throttle_ms: input.throttleMs ?? undefined,
      notes: input.notes ?? undefined,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from("controller_profiles")
      .upsert(payload, { onConflict: input.controllerId ? "controller_id" : "domain" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, profile: data });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("[profiles/upsert] error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
