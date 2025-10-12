/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const { mail_id } = (await req.json().catch(() => ({}))) as { mail_id?: string };
    if (!mail_id) return NextResponse.json({ error: "mail_id required" }, { status: 400 });

    const db = serverDB();

    // 1) load mail row
    const { data: mail, error: mErr } = await db
      .from("mail_intake")
      .select("id, from, to, subject, body_text, correlation_hint, meta, routed_to_request_id, created_at")
      .eq("id", mail_id)
      .maybeSingle();
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    if (!mail) return NextResponse.json({ error: "mail not found" }, { status: 404 });

    // already linked?
    if (mail.routed_to_request_id) {
      return NextResponse.json({ ok: true, request_id: mail.routed_to_request_id, already_linked: true });
    }

    // 2) create request
    const title =
      (mail.subject && mail.subject.trim()) ||
      `Inbound message from ${mail.from || "unknown"} (${new Date(mail.created_at).toLocaleString()})`;

    const description = [
      `From: ${mail.from || "-"}`,
      `To: ${mail.to || "-"}`,
      `Subject: ${mail.subject || "-"}`,
      "",
      mail.body_text || "",
    ].join("\n");

    const vendor = (mail.meta?.vendor as string | undefined) ?? "unknown";
    const type = (mail.meta?.type as string | undefined) ?? "lead";

    const { data: created, error: cErr } = await db
      .from("requests")
      .insert([
        {
          title,
          description,
          status: "new",
          source: vendor,           // harmless extra column if you have it, otherwise ignored
          type,                     // same—ignored if column doesn't exist
        } as any,
      ])
      .select("id")
      .maybeSingle();

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if (!created?.id) return NextResponse.json({ error: "failed to create request" }, { status: 500 });

    // 3) link mail -> request (store UUID back on mail row)
    const { error: uErr } = await db
      .from("mail_intake")
      .update({ routed_to_request_id: created.id })
      .eq("id", mail.id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, request_id: created.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "open-request failed" }, { status: 500 });
  }
}
