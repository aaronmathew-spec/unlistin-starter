/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function envBool(v?: string) { return v === "1" || v?.toLowerCase() === "true"; }

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isUUID(s: string | null | undefined) {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_MAILROOM)) {
      return NextResponse.json({ error: "mailroom disabled" }, { status: 503 });
    }

    // Parse body (JSON, form-encoded, or raw)
    let parsed: any = null;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      parsed = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      parsed = Object.fromEntries(fd.entries());
    } else {
      const raw = await req.text().catch(() => "");
      try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
    }

    // Normalize fields
    const from = parsed.from || parsed.sender || parsed.envelope?.from || "";
    const to = Array.isArray(parsed.to) ? parsed.to.join(", ") : (parsed.to || "");
    const subject = parsed.subject || "";
    const body_text = parsed.text || parsed["body-plain"] || parsed.body || parsed.raw || "";
    const message_id =
      parsed["Message-Id"] || parsed.messageId || parsed.headers?.["message-id"] || "";

    // Correlation: we keep a human hint AND (if present) a real UUID
    let correlation_hint = "";
    const joined = `${subject}\n${body_text}`;

    // numeric “Request 101” -> goes to correlation_hint only
    const mNum = /request[_\s-]?id[:\s-]?(\d{1,10})/i.exec(joined) || /request\s+(\d{1,10})/i.exec(joined);
    if (mNum) correlation_hint = mNum[1]!;

    // try to find a UUID in text; only this goes into routed_to_request_id (uuid column)
    const mUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.exec(joined);
    const routedUUID = mUUID && isUUID(mUUID[0]!) ? mUUID[0]! : null;

    // Insert
    const db = serverDB();
    const { error } = await db.from("mail_intake").insert([{
      org_id: null,
      message_id: message_id || null,
      from,
      subject,
      body_text,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      correlation_hint,                 // "101" stays here for operators/heuristics
      routed_to_request_id: routedUUID, // ONLY a UUID or null
    }]);

    if (error) {
      console.error("mail_intake insert error", error);
      return NextResponse.json({ error: "db insert failed", detail: error.message }, { status: 500 });
    }

    // Best-effort trigger OTP scan
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
    return NextResponse.json({ error: e?.message ?? "mail webhook failed" }, { status: 500 });
  }
}

// Optional ping to check env wiring
export async function GET() {
  return NextResponse.json({
    ok: true,
    feature_mailroom: envBool(process.env.FEATURE_MAILROOM ?? ""),
    has_service_role: !!process.env.SUPABASE_SERVICE_ROLE,
    base_url: process.env.NEXT_PUBLIC_BASE_URL ?? null,
  });
}
