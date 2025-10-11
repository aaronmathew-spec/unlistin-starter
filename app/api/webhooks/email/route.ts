/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { serverDB } from "@/lib/server-db";
import { audit } from "@/lib/audit";

function envBool(v?: string) { return v === "1" || v?.toLowerCase() === "true"; }

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_MAILROOM)) {
      return NextResponse.json({ error: "mailroom disabled" }, { status: 503 });
    }

    // Accept JSON or form-encoded (Mailgun)
    let parsed: any = null;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      parsed = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      parsed = Object.fromEntries(fd.entries());
    } else {
      parsed = await req.text().catch(() => "");
      try { parsed = JSON.parse(parsed); } catch { /* ignore */ }
    }

    // Normalize a few common providers
    // Resend Inbound: { to, from, subject, text, html, headers, ... }
    // Mailgun: fields 'from', 'subject', 'body-plain', 'Message-Id', ...
    const from = parsed.from || parsed.sender || parsed.envelope?.from || "";
    const subject = parsed.subject || "";
    const body_text = parsed.text || parsed["body-plain"] || parsed.body || "";
    const message_id = parsed["Message-Id"] || parsed.messageId || parsed.headers?.["message-id"] || "";
    const to = Array.isArray(parsed.to) ? parsed.to.join(", ") : (parsed.to || "");

    // A simple correlation hint: look for a Request ID pattern like "Request 123" or explicit "request_id:123"
    const correlation_hint =
      /request[_\s-]?id[:\s-]?(\d{1,10})/i.test(body_text) ? RegExp.$1 :
      /request\s+(\d{1,10})/i.test(subject) ? RegExp.$1 :
      "";

    const db = serverDB();
    const orgId = null; // set org if you add multi-tenant claims later

    const { error } = await db.from("mail_intake").insert([{
      org_id: orgId,
      message_id: message_id || null,
      from,
      subject,
      body_text,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      correlation_hint,
      routed_to_request_id: correlation_hint ? Number(correlation_hint) : null
    }]);

    if (error) {
      console.error("mail_intake insert error", error);
      return NextResponse.json({ error: "db insert failed" }, { status: 500 });
    }

    audit("mailroom.intake", { message_id, from, to, subject, correlation_hint });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("mailroom webhook error", e);
    return NextResponse.json({ error: e?.message ?? "mail webhook failed" }, { status: 500 });
  }
}
