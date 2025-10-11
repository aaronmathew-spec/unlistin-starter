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

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_MAILROOM)) {
      return NextResponse.json({ error: "mailroom disabled" }, { status: 503 });
    }

    // Accept JSON or form-encoded (Mailgun), else try raw text->JSON
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

    // Normalize common fields across providers
    const from = parsed.from || parsed.sender || parsed.envelope?.from || "";
    const to = Array.isArray(parsed.to) ? parsed.to.join(", ") : (parsed.to || "");
    const subject = parsed.subject || "";
    const body_text = parsed.text || parsed["body-plain"] || parsed.body || parsed.raw || "";
    const message_id =
      parsed["Message-Id"] || parsed.messageId || parsed.headers?.["message-id"] || "";

    // Simple correlation: capture a request id if present in subject/body
    // Matches: "request_id:123" OR "Request 123"
    let correlation_hint = "";
    const joined = `${subject}\n${body_text}`;
    const m1 = /request[_\s-]?id[:\s-]?(\d{1,10})/i.exec(joined);
    const m2 = !m1 && /request\s+(\d{1,10})/i.exec(joined);
    if (m1) correlation_hint = m1[1]!;
    else if (m2) correlation_hint = m2[1]!;

    // Insert into DB
    const db = serverDB();
    const orgId = null; // set from JWT claims later if you add multi-tenant orgs

    const { error } = await db.from("mail_intake").insert([{
      org_id: orgId,
      message_id: message_id || null,
      from,
      subject,
      body_text,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      correlation_hint,
      routed_to_request_id: correlation_hint ? correlation_hint : null
    }]);

    if (error) {
      console.error("mail_intake insert error", error);
      return NextResponse.json({ error: "db insert failed" }, { status: 500 });
    }

    // --- STEP 4 ADDITION: kick off a quick OTP scan immediately ---
    // best-effort: even if this fails, we still return 200 to the email provider
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
      // Scan the last 5 minutes, at most 10 messages (this one will be included)
      await fetch(`${base}/api/otp/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ since_minutes: 5, limit: 10 })
      });
    } catch (e) {
      // don't block webhook success on scan failures
      console.warn("otp scan trigger failed:", (e as any)?.message ?? e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("mailroom webhook error", e);
    return NextResponse.json({ error: e?.message ?? "mail webhook failed" }, { status: 500 });
  }
}
