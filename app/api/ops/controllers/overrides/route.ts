// app/api/ops/controllers/overrides/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  // Fail fast at deploy-time to avoid confusing runtime errors.
  // eslint-disable-next-line no-console
  console.warn("[overrides.api] Missing Supabase envs");
}

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

function sb() {
  return createSb(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * GET: list overrides
 * Optional query: ?controllerKey=...
 */
export async function GET(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || req.headers.get("x-ops-secret") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const url = new URL(req.url);
  const controllerKey = url.searchParams.get("controllerKey") || undefined;

  const client = sb();
  const q = client.from("controller_overrides").select("*").order("controller_key", { ascending: true });
  const { data, error } = controllerKey ? await q.eq("controller_key", controllerKey) : await q;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}

/**
 * POST: upsert override
 * Body: {
 *   controllerKey: string,
 *   preferredChannel?: "email"|"webform"|null,
 *   emailOverride?: string|null,
 *   allowedChannels?: ("email"|"webform")[]|null,
 *   slas?: { acknowledgeMin?: number|null, resolveMin?: number|null }|null,
 *   identity?: { hints?: string[]|null }|null
 * }
 */
export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || req.headers.get("x-ops-secret") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const controllerKey = (body?.controllerKey || "").toString().trim().toLowerCase();
  if (!controllerKey) {
    return NextResponse.json({ ok: false, error: "controllerKey is required" }, { status: 400 });
  }

  const row = {
    controller_key: controllerKey,
    preferred_channel: (body?.preferredChannel ?? null) as "email" | "webform" | null,
    email_override: (body?.emailOverride ?? null) as string | null,
    allowed_channels: Array.isArray(body?.allowedChannels) ? body.allowedChannels : null,
    slas: body?.slas ?? null,
    identity: body?.identity ?? null,
    updated_at: new Date().toISOString(),
  };

  const client = sb();
  const { data, error } = await client.from("controller_overrides").upsert(row, {
    onConflict: "controller_key",
  }).select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
