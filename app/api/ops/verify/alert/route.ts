/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmailResend } from "@/lib/email/resend";
import { renderSimpleEmail } from "@/lib/email/templates/simple";

/**
 * Auth: header `x-secure-cron: <SECURE_CRON_SECRET>`
 * Purpose: Send a consolidated email to ADMIN_EMAILS listing verification
 *          records that are past-due for recheck (or stale for too long).
 *
 * NOTE: This does not perform the recheck; it only notifies. Keep your
 *       /api/ops/verify/recheck job to do the actual work.
 */

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Heuristic thresholds (tweak freely)
const STALE_MINUTES_DEFAULT = 24 * 60; // 24h since last update if no next_recheck_at
const WINDOW_LIMIT = 2000; // max rows to scan
const MAX_LINES_PER_GROUP = 20;

// Common “still pending” statuses; unknowns are grouped as "unknown".
const PENDING_STATUSES = new Set(["pending", "awaiting", "submitted", "queued", "checking"]);

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

function baseUrl(req: Request): string {
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
  if ((req.headers.get("x-secure-cron") || "").trim() !== OPS_SECRET) return forbidden("invalid_secret");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }
  if (ADMIN_EMAILS.length === 0) {
    return NextResponse.json({ ok: true, info: "no_admin_emails_configured" });
  }

  const sb = srv();

  // Broad, nullable fields—schema-tolerant.
  const { data, error } = await sb
    .from("verifications")
    .select("id, controller_key, status, updated_at, next_recheck_at")
    .order("updated_at", { ascending: true })
    .limit(WINDOW_LIMIT);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    controller_key?: string | null;
    status?: string | null;
    updated_at?: string | null;
    next_recheck_at?: string | null;
  };

  const now = Date.now();
  const staleMinMs = STALE_MINUTES_DEFAULT * 60 * 1000;

  // Pick candidates: next_recheck_at <= now OR (pending status and last update too old)
  const candidates = (data || []).filter((r: Row) => {
    const status = (r.status || "").toString().toLowerCase();
    const nextRecheckDue = r.next_recheck_at ? new Date(r.next_recheck_at).getTime() <= now : false;

    const lastUpd = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    const tooOld = lastUpd > 0 ? now - lastUpd > staleMinMs : false;

    const looksPending = PENDING_STATUSES.has(status) || status === "";

    return nextRecheckDue || (looksPending && tooOld);
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, due: 0 });
  }

  // Group by controller
  const groups: Record<string, Array<{ id: string; status: string; ageMin: number; due: boolean }>> = {};
  for (const r of candidates as Row[]) {
    const key = (r.controller_key || "*").toString();
    const status = (r.status || "unknown").toString();
    const lastUpd = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    const ageMin = lastUpd ? Math.round((now - lastUpd) / 60000) : -1;
    const due = r.next_recheck_at ? new Date(r.next_recheck_at).getTime() <= now : false;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ id: r.id, status, ageMin, due });
  }

  const origin = baseUrl(req);
  const opsUrl = `${origin}/ops/overview`;

  const lines: string[] = [];
  const keys = Object.keys(groups).sort();
  for (const k of keys) {
    const arr = groups[k] || [];
    const total = arr.length;
    const dueCount = arr.filter((x) => x.due).length;
    lines.push(`• ${k}: ${total} pending (${dueCount} due for recheck)`);
    for (const row of arr.slice(0, MAX_LINES_PER_GROUP)) {
      const aging = row.ageMin >= 0 ? ` · age ${row.ageMin} min` : "";
      const dueMark = row.due ? " · DUE" : "";
      lines.push(`    - ${row.id} · ${row.status}${aging}${dueMark}`);
    }
    if (total > MAX_LINES_PER_GROUP) {
      lines.push(`    … and ${total - MAX_LINES_PER_GROUP} more`);
    }
  }

  const { html, text } = renderSimpleEmail({
    title: "UnlistIN — Verification Recheck Summary",
    intro:
      "These verification records are either past their next_recheck_at or have been pending longer than the threshold. Review and trigger rechecks if needed.",
    bullets: lines,
    cta: { label: "Open Ops Overview", href: opsUrl },
    footer: "You are receiving this because you are listed in ADMIN_EMAILS.",
    brand: { product: "UnlistIN", url: origin },
  });

  const sent = await sendEmailResend({
    to: ADMIN_EMAILS,
    subject: "UnlistIN · Verification Recheck Summary",
    text,
    html,
    tags: { type: "verify_recheck_summary", controllers: keys.length },
  });

  if (!sent.ok) {
    return NextResponse.json({ ok: false, error: sent.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    controllers: keys.length,
    messageId: sent.id ?? null,
  });
}
