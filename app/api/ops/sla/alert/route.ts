// app/api/ops/sla/alert/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmailResend } from "@/lib/email/resend";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);

const TARGET_MINUTES: Record<string, number> = {
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

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const hdr = req.headers.get("x-secure-cron") || "";
  if (hdr !== OPS_SECRET) return forbidden("invalid_secret");

  const sb = srv();
  const { data, error } = await sb
    .from("webform_jobs")
    .select("id, created_at, controller_key, status")
    .in("status", ["queued", "running", "failed"])
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const breaches: Record<string, { id: string; ageMin: number; status: string }[]> = {};
  for (const j of data || []) {
    const key = (j.controller_key || "*") as string;
    const targetMs = targetFor(key) * 60 * 1000; // <- now guaranteed number
    const ageMs = now - new Date(j.created_at as string).getTime();
    if (ageMs > targetMs) {
      if (!breaches[key]) breaches[key] = [];
      breaches[key].push({
        id: j.id as string,
        ageMin: Math.floor(ageMs / 60000),
        status: j.status as string,
      });
    }
  }

  const totalBreaches = Object.values(breaches).reduce((n, arr) => n + arr.length, 0);
  if (!totalBreaches) {
    return NextResponse.json({ ok: true, breached: 0 });
  }

  const lines: string[] = [];
  lines.push(`SLA Breach Report – ${new Date().toLocaleString()}`);
  lines.push("");
  for (const key of Object.keys(breaches).sort()) {
    const arr = breaches[key];
    lines.push(`• ${key} (target ${targetFor(key)} min): ${arr.length} breach(es)`);
    for (const b of arr.slice(0, 20)) {
      lines.push(`    - ${b.id} · ${b.status} · age ${b.ageMin} min`);
    }
    if (arr.length > 20) lines.push(`    … and ${arr.length - 20} more`);
    lines.push("");
  }
  const body = lines.join("\n");

  if (ADMIN_EMAILS.length) {
    await sendEmailResend({
      to: ADMIN_EMAILS,
      subject: "UnlistIN – SLA Breach Report",
      text: body,
      tags: { type: "sla_breach" },
    });
  }

  return NextResponse.json({ ok: true, breached: totalBreaches });
}
