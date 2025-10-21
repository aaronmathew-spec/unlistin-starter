/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

type KV<T extends string = string> = Record<T, any>;

function ok(v: any) { return { ok: true as const, value: v }; }
function err(e: any) { return { ok: false as const, error: String(e?.message || e) }; }

function truthyEnv(name: string) {
  const v = process.env[name];
  return (v && v.trim().length > 0) ? "present" : "missing";
}

export async function GET() {
  const startedAt = new Date().toISOString();

  // --- ENV + Build meta
  const envs: KV =
  {
    SECURE_CRON_SECRET: truthyEnv("SECURE_CRON_SECRET"),
    NEXT_PUBLIC_SUPABASE_URL: truthyEnv("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE: truthyEnv("SUPABASE_SERVICE_ROLE"),
    RESEND_API_KEY: truthyEnv("RESEND_API_KEY"),
    EMAIL_FROM: truthyEnv("EMAIL_FROM"),
    SIGNING_BACKEND: process.env.SIGNING_BACKEND || "(unset)",
    AWS_REGION: process.env.AWS_REGION ? "present" : "missing",
    AWS_KMS_KEY_ID: process.env.AWS_KMS_KEY_ID ? "present" : "missing",
    VERCEL: process.env.VERCEL ? "true" : "false",
  };

  const build: KV =
  {
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    env: process.env.NODE_ENV,
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    region: process.env.VERCEL_REGION || null,
    startedAt,
  };

  // --- Supabase (optional; tolerate missing)
  let supabaseStatus: ReturnType<typeof ok> | ReturnType<typeof err> = ok({ connected: false });
  let queueDepth: number | null = null;
  let lastWorkerSuccess: string | null = null;
  let lastVerifyRecheck: string | null = null;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE!;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(url, key, { auth: { persistSession: false } });

      // Try to read queue depth (tolerate table not found)
      try {
        const { count, error } = await sb
          .from("webform_jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["queued", "claimed"]);
        if (!error) queueDepth = count ?? 0;
      } catch { /* ignore */ }

      // Try to read last worker success (tolerate missing)
      try {
        const { data } = await sb
          .from("webform_jobs")
          .select("completed_at")
          .eq("status", "succeeded")
          .order("completed_at", { ascending: false })
          .limit(1);
        lastWorkerSuccess = data?.[0]?.completed_at ?? null;
      } catch { /* ignore */ }

      // Try to read last verify recheck (either a log table or verifications activity)
      try {
        // Option A: dedicated log table (if you added one)
        const { data: log } = await sb
          .from("ops_cron_log")
          .select("route, ran_at")
          .eq("route", "/api/ops/verify/recheck")
          .order("ran_at", { ascending: false })
          .limit(1);
        lastVerifyRecheck = log?.[0]?.ran_at ?? null;
      } catch { /* ignore */ }

      supabaseStatus = ok({ connected: true });
    } else {
      supabaseStatus = err(new Error("Supabase env missing"));
    }
  } catch (e: any) {
    supabaseStatus = err(e);
  }

  // --- Email provider (don’t send email here; just config presence)
  const email: KV =
  {
    provider: "resend",
    configured: process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? true : false,
  };

  // --- Cron preview helper
  const cronHeaderConfigured = envs.SECURE_CRON_SECRET === "present";

  // --- Channel status: which automation endpoints exist
  const endpoints: KV =
  {
    worker: "/api/ops/webform/worker",
    verifyRecheck: "/api/ops/verify/recheck",
    verifyAlert: "/api/ops/verify/alert",
  };

  // --- Summarize
  const summary: KV =
  {
    ok:
      envs.SECURE_CRON_SECRET === "present" &&
      (supabaseStatus as any)?.ok &&
      email.configured,
    reasons: [
      envs.SECURE_CRON_SECRET !== "present" ? "SECURE_CRON_SECRET missing" : null,
      !(supabaseStatus as any)?.ok ? "Supabase not reachable (or env missing)" : null,
      !email.configured ? "Email provider not configured" : null,
    ].filter(Boolean),
  };

  return NextResponse.json({
    ok: true,
    summary,
    build,
    envs,
    supabase: supabaseStatus,
    queueDepth,
    lastWorkerSuccess,
    lastVerifyRecheck,
    email,
    cronHeaderConfigured,
    endpoints,
  });
}
