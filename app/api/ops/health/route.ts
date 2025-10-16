// app/api/ops/health/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);

function json(data: any, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  return createSb(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const checks: Record<string, any> = {};
  const t0 = Date.now();

  // Core envs
  checks.env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
    SECURE_CRON_SECRET: !!process.env.SECURE_CRON_SECRET,
    ADMIN_EMAILS: ADMIN_EMAILS.length > 0,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    SIGNING_BACKEND: process.env.SIGNING_BACKEND || "local-ed25519",
    AWS_REGION: process.env.AWS_REGION || null,
    AWS_KMS_KEY_ID: process.env.AWS_KMS_KEY_ID || null,
  };

  // Supabase reach + overrides count
  try {
    const client = sb();
    if (client) {
      const { data: ov, error: e1 } = await client
        .from("controller_overrides")
        .select("controller_key", { count: "exact", head: true });
      checks.supabase = { ok: !e1, overridesCount: ov === null ? (e1 ? 0 : 0) : (ov as any)?.length ?? null };
    } else {
      checks.supabase = { ok: false, error: "missing_supabase_env" };
    }
  } catch (e: any) {
    checks.supabase = { ok: false, error: String(e?.message || e) };
  }

  // Cron reminders (purely advisory)
  const cronSet = !!process.env.SECURE_CRON_SECRET; // header guard exists; Vercel Cron must be added in UI
  checks.cron = {
    hasSecret: cronSet,
    advice: cronSet
      ? "Ensure two Vercel Cron jobs exist: /api/ops/webform/worker (10m) and /api/ops/verify/recheck + /api/ops/verify/alert (6h) with x-secure-cron."
      : "Set SECURE_CRON_SECRET and add the two Vercel Cron jobs.",
  };

  // Email readiness (config-only, no live send here)
  checks.email = {
    provider: "Resend",
    configured: !!process.env.RESEND_API_KEY,
    advice: "Verify sender domain (SPF/DKIM) in Resend dashboard and set FROM address in env if using one.",
  };

  // Signing backend snapshot
  const backend = process.env.SIGNING_BACKEND || "local-ed25519";
  checks.signing = {
    backend,
    kmsReady: backend === "aws-kms" ? !!(process.env.AWS_REGION && process.env.AWS_KMS_KEY_ID) : null,
  };

  return json({
    ok: true,
    tookMs: Date.now() - t0,
    checks,
  });
}
