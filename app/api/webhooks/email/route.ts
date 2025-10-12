/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ---------- helpers ---------- */

function envBool(v?: string) {
  return v === "1" || v?.toLowerCase() === "true";
}

function assertEnv(name: string, val?: string | null) {
  if (!val || !val.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return val.trim();
}

function isUUID(s: string | null | undefined) {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Server-only Supabase client using SERVICE ROLE (required for inserts here). */
function serverDB() {
  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = assertEnv("SUPABASE_SERVICE_ROLE", process.env.SUPABASE_SERVICE_ROLE);
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------- routes ---------- */

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_MAILROOM)) {
      return NextResponse.json({ error: "mailroom disabled" }, { status: 503 });
    }

    // Parse body (JSON, form-data (x-www-form-urlencoded), or raw)
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let parsed: any = null;

    if (ct.includes("application/json")) {
      parsed = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      parsed = Object.fromEntries(fd.entries());
    } else {
      const raw = await req.text().catch(() => "");
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { raw };
      }
    }

    // Normalize fields from common providers
    const from = parsed.from || parsed.sender || parsed.envelope?.from || "";
    const to = Array.isArray(parsed.to) ? parsed.to.join(", ") : (parsed.to || "");
    const subject = parsed.subject || "";
    const body_text = parsed.text || parsed["body-plain"] || parsed.body || parsed.raw || "";
    const message_id =
      parsed["Message-Id"] || parsed.messageId || parsed.headers?.["message-id"] || "";

    // Try to correlate: keep a human hint (numeric id) and a real UUID if present
    const joined = `${subject}\n${body_text}`;

    let correlation_hint = "";
    const mNum =
      /request[_\s-]?id[:\s-]?(\d{1,10})/i.exec(joined) ||
      /request\s+(\d{1,10})/i.exec(joined);
    if (mNum) correlation_hint = mNum[1]!;

    const mUUID =
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.exec(joined);
    const routedUUID = mUUID && isUUID(mUUID[0]!) ? mUUID[0]! : null;

    // Insert
    const db = serverDB();
    const { error } = await db.from("mail_intake").insert([
      {
        org_id: null, // set later when you have org routing
        message_id: message_id || null,
        from,
        to,                // ✅ store the "to" address
        subject,
        body_text,
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        correlation_hint,                 // e.g. "101"
        routed_to_request_id: routedUUID, // ONLY a UUID or null
      },
    ]);

    if (error) {
      // Surface exact DB error so you can fix schema/policy quickly
      console.error("mail_intake insert error", error);
      return NextResponse.json(
        { error: "db insert failed", detail: error.message },
        { status: 500 }
      );
    }

    // Best-effort trigger OTP scan (doesn't block the response)
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
      if (base) {
        await fetch(`${base}/api/otp/scan`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ since_minutes: 5, limit: 10 }),
        });
      }
    } catch (e) {
      console.warn("otp scan trigger failed:", (e as any)?.message ?? e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("mailroom webhook error", e);
    return NextResponse.json(
      { error: e?.message ?? "mail webhook failed" },
      { status: 500 }
    );
  }
}

/** Health/diagnostics (safe): shows URL & key lengths, not the keys. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonLen = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").length;
  const srvLen = (process.env.SUPABASE_SERVICE_ROLE ?? "").length;

  return NextResponse.json({
    ok: true,
    feature_mailroom: envBool(process.env.FEATURE_MAILROOM ?? ""),
    has_service_role: !!process.env.SUPABASE_SERVICE_ROLE,
    base_url: process.env.NEXT_PUBLIC_BASE_URL ?? null,
    supabase_url: url,
    anon_key_len: anonLen,
    service_role_len: srvLen,
  });
}
