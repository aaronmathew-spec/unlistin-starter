// app/api/ops/health/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function json(data: any, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init?.headers || {}),
    },
  });
}

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  return createSb(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeBool(v: unknown) {
  return !!(typeof v === "string" ? v.trim() : v);
}

export async function GET() {
  const t0 = Date.now();
  const checks: Record<string, any> = {};

  // -------- Core envs (presence only; values redacted) --------
  checks.env = {
    NEXT_PUBLIC_SUPABASE_URL: safeBool(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE: safeBool(process.env.SUPABASE_SERVICE_ROLE),
    SECURE_CRON_SECRET: safeBool(process.env.SECURE_CRON_SECRET),
    ADMIN_EMAILS: ADMIN_EMAILS.length > 0,
    RESEND_API_KEY: safeBool(process.env.RESEND_API_KEY),
    SIGNING_BACKEND: (process.env.SIGNING_BACKEND || "local-ed25519").trim(),
    AWS_REGION: process.env.AWS_REGION || null,
    AWS_KMS_KEY_ID: process.env.AWS_KMS_KEY_ID || null,
  };

  // -------- Supabase reachability (cheap & safe) --------
  try {
    const client = sb();
    if (client) {
      // HEAD+count only — no data pulled
      const { error: e1, count } = await client
        .from("controller_overrides")
        .select("*", { count: "exact", head: true });
      checks.supabase = { ok: !e1, overridesCount: typeof count === "number" ? count : null };
    } else {
      checks.supabase = { ok: false, error: "missing_supabase_env" };
    }
  } catch (e: any) {
    checks.supabase = { ok: false, error: String(e?.message || e) };
  }

  // -------- Cron reminders (advisory only) --------
  const cronSet = safeBool(process.env.SECURE_CRON_SECRET);
  checks.cron = {
    hasSecret: cronSet,
    advice: cronSet
      ? "Ensure Vercel Cron is configured: /api/ops/webform/worker (*/10) and any verify/recheck jobs with x-secure-cron."
      : "Set SECURE_CRON_SECRET and add the Vercel Cron jobs.",
  };

  // -------- Email readiness (config snapshot only) --------
  checks.email = {
    provider: "Resend",
    configured: safeBool(process.env.RESEND_API_KEY),
    advice: "Verify sender domain (SPF/DKIM) in Resend and set a FROM address if required.",
  };

  // -------- Signing backend snapshot --------
  const backend = (process.env.SIGNING_BACKEND || "local-ed25519").trim();
  checks.signing = {
    backend,
    kmsReady:
      backend === "aws-kms"
        ? !!(process.env.AWS_REGION && process.env.AWS_KMS_KEY_ID)
        : null,
  };

  // -------- Feature presence (routes wired) --------
  checks.features = {
    webformWorker: true, // /api/ops/webform/worker present
    dispatchAPI: true,   // /api/ops/dispatch/* present
    proofs: true,        // /api/proofs/* present
    dlq: true,           // /ops/dlq present
  };

  // -------- Runtime snapshot --------
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const now = new Date();

  return json({
    ok: true,
    tookMs: Date.now() - t0,
    service: "unlistin",
    time: now.toISOString(),
    timezone: tz,
    uptime_s: Number(process.uptime()),
    node: process.version,
    checks,
  });
}
