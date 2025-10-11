export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { audit } from "@/lib/audit";

function envBool(v?: string) {
  return v === "1" || v?.toLowerCase() === "true";
}

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_REMOVAL)) {
      return NextResponse.json({ error: "removal feature disabled" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({})) as {
      to: string[];
      cc?: string[];
      subject: string;
      text: string;
    };

    if (!Array.isArray(body.to) || body.to.length === 0) {
      return NextResponse.json({ error: "to[] required" }, { status: 400 });
    }
    const from = process.env.SMTP_FROM!;
    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;

    const transport = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass }
    });

    const info = await transport.sendMail({
      from,
      to: body.to.join(", "),
      cc: (body.cc ?? []).join(", "),
      subject: body.subject,
      text: body.text
    });

    audit("removal.email.sent", { messageId: info.messageId, to: body.to, subject: body.subject });
    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    console.error("email-send error", e);
    return NextResponse.json({ error: "email send failed", detail: e?.message }, { status: 500 });
  }
}
