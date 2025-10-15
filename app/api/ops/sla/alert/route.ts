// app/api/ops/sla/alert/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmailResend } from "@/lib/email/resend";
import { renderSimpleEmail } from "@/lib/email/templates/simple";

/**
 * Auth: header `x-secure-cron: <SECURE_CRON_SECRET>`
 * Sends a consolidated SLA-breach email to ADMIN_EMAILS when jobs exceed target minutes.
 */

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Per-controller SLA targets (minutes)
type Targets = Record<string, number> & { "*": number };
const TARGET_MINUTES: Targets = {
  truecaller: 60,
  naukri: 180,
  olx: 120,
  foundit: 180,
  shine: 180,
  timesjobs: 180,
  "*": 240,
};

function targetFor(key: string): number {
  const v = TARGET_MINUTES[key];
  return typeof v === "number" ? v : TARGET_MINUTES["*"];
}

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

function baseUrl(req: Request): string {
  // Prefer incoming headers (works on Vercel), else fallback to env
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("secret_not_set");
  if ((req.headers.get("x-secure-cron") || "") !== OPS_SECRET) return forbidden("invalid_secret");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  // If no recipients configured, be graceful and noop
  if (ADMIN_EMAILS.length === 0) {
    return NextResponse.json({ ok: true, info: "no_admin_emails_configured" });
  }

  const sb = srv();

  // Pull recent jobs that could be in breach. You can widen the window if needed.
  const { data, error } = await sb
    .from("webform_jobs")
    .select("id, created_at, controller_key, status")
    .in("status", ["queued", "running", "failed"])
    .order("created_at", { ascending: true })
    .limit(2000);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const now = Date.now();

  type Row = {
    id: string;
    created_at: string;
    controller_key: string | null;
    status: string | null;
  };

  // Group breaches by controller
  const breaches: Record<
    string,
    Array<{ id: string; status: string; ageMin: number }>
  > = {};

  for (const j of (data || []) as Row[]) {
    const key = (j.controller_key || "*").toString();
    const targetMs = targetFor(key) * 60 * 1000;
    const ageMs = now - new Date(j.created_at).getTime();
    if (ageMs > targetMs) {
      if (!breaches[key]) breaches[key] = [];
      breaches[key].push({
        id: j.id,
        status: (j.status || "unknown").toString(),
        ageMin: Math.round(ageMs / 60000),
      });
    }
  }

  // Nothing breached → early exit
  const keys = Object.keys(breaches);
  if (keys.length === 0) {
    return NextResponse.json({ ok: true, breached: 0 });
  }

  // Build a concise, actionable email
  const origin = baseUrl(req);
  const opsUrl = `${origin}/ops/webforms`;

  const lines: string[] = [];
  for (const key of keys.sort()) {
    const arr = breaches[key] || [];
    lines.push(`• ${key} (target ${targetFor(key)} min): ${arr.length} breach(es)`);
    for (const b of arr.slice(0, 20)) {
      lines.push(`    - ${b.id} · ${b.status} · age ${b.ageMin} min`);
    }
    if (arr.length > 20) lines.push(`    … and ${arr.length - 20} more`);
  }

  const { html, text } = renderSimpleEmail({
    title: "UnlistIN — SLA Breach Summary",
    intro:
      "The following controller queues have jobs older than their SLA targets. Review and take action.",
    bullets: lines,
    cta: { label: "Open Ops Webforms", href: opsUrl },
    footer: "You are receiving this because you are listed in ADMIN_EMAILS.",
    brand: { product: "UnlistIN", url: origin },
  });

  const send = await sendEmailResend({
    to: ADMIN_EMAILS,
    subject: "UnlistIN · SLA Breach Summary",
    text,
    html,
    tags: { type: "sla_breach", count: keys.length },
  });

  if (!send.ok) {
    return NextResponse.json({ ok: false, error: send.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: true, controllers: keys.length, messageId: send.id });
}
