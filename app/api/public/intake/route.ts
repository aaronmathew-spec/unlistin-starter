/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

/**
 * Table (create if missing):
 *
 * create table if not exists public.intake_leads (
 *   id uuid primary key default gen_random_uuid(),
 *   created_at timestamptz default now(),
 *   name text,
 *   email text not null,
 *   region text,
 *   goals text,
 *   referral text,
 *   ip_hash text
 * );
 * create index if not exists intake_leads_email_idx on public.intake_leads (lower(email));
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";
const IP_SALT = (process.env.INTAKE_IP_SALT || process.env.SECURE_CRON_SECRET || "").trim(); // reuse if no dedicated salt

function db() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

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

function hashIp(ip: string | null | undefined) {
  if (!ip || !IP_SALT) return null;
  try {
    return createHash("sha256").update(IP_SALT + "::" + ip).digest("hex");
  } catch {
    return null;
  }
}

function sanitize(s: unknown, max = 2000): string | null {
  const v = String(s ?? "").trim();
  if (!v) return null;
  return v.slice(0, max);
}

export async function POST(req: Request) {
  try {
    // Basic JSON parse
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      region?: string;
      goals?: string;
      referral?: string;
    };

    const email = sanitize(body.email, 320);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const name = sanitize(body.name, 160);
    const region = sanitize(body.region, 32) || "IN";
    const goals = sanitize(body.goals, 5000);
    const referral = sanitize(body.referral, 160);

    // derive an IP hash (best-effort)
    // On Vercel, this header is set: x-forwarded-for
    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
      (req.headers.get("x-real-ip") || "").trim() ||
      undefined;
    const ipHash = hashIp(ip);

    // Insert
    const client = db();
    const { error } = await client.from("intake_leads").insert({
      name,
      email,
      region,
      goals,
      referral,
      ip_hash: ipHash,
    } as any);

    if (error) {
      // Unique or validation issues still return 200 to avoid oracle for bots.
      return json({ ok: true, note: "received" }, { status: 200 });
    }

    // (Optional) Email notify — behind flag to avoid surprises.
    // if (process.env.FEATURE_RESEND === "1" && process.env.RESEND_API_KEY) {
    //   // send a lightweight notification or welcome (omitted to keep this drop-in safe)
    // }

    // Respond with success (no sensitive echo)
    return json({ ok: true, next: "/start/thanks" }, { status: 200 });
  } catch (e: any) {
    // Do not leak details
    return json({ ok: false, error: "intake_failed" }, { status: 500 });
  }
}
