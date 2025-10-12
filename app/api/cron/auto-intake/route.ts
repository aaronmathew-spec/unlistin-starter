/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function envBool(v?: string) { return v === "1" || v?.toLowerCase() === "true"; }

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function triageNow(baseUrl: string) {
  // call your existing triage endpoint to enrich meta (type/vendor/otp/request_hint)
  const res = await fetch(`${baseUrl}/api/agent/triage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function GET(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_MAILROOM)) {
      return NextResponse.json({ error: "mailroom disabled" }, { status: 503 });
    }
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const wantSecret = (process.env.CRON_SECRET || "").trim();
    if (wantSecret) {
      const got = (req.headers.get("x-cron-secret") || "").trim();
      if (got !== wantSecret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const db = serverDB();

    // 1) triage recent un-triaged mail
    const triage = await triageNow(base);

    // 2) pick mail rows eligible to auto-open (no routed request yet; meta.type in allowlist)
    const { data: mails, error } = await db
      .from("mail_intake")
      .select("id, from, to, subject, body_text, created_at, meta, routed_to_request_id")
      .is("routed_to_request_id", null)
      .in("meta->>type", ["otp", "lead", "support"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let opened = 0;
    for (const m of mails ?? []) {
      // build title/description
      const title =
        (m.subject && m.subject.trim()) ||
        `Inbound message from ${m.from || "unknown"} (${new Date(m.created_at).toLocaleString()})`;

      const description = [
        `From: ${m.from || "-"}`,
        `To: ${m.to || "-"}`,
        `Subject: ${m.subject || "-"}`,
        "",
        m.body_text || "",
      ].join("\n");

      // create request
      const { data: created, error: cErr } = await db
        .from("requests")
        .insert([{ title, description, status: "new" } as any])
        .select("id")
        .maybeSingle();
      if (cErr || !created?.id) continue;

      // link mail -> request
      const { error: uErr } = await db
        .from("mail_intake")
        .update({ routed_to_request_id: created.id })
        .eq("id", m.id);
      if (!uErr) opened += 1;
    }

    return NextResponse.json({
      ok: true,
      triage_status: triage.status,
      triaged: triage.json?.triaged ?? null,
      opened
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "auto-intake failed" }, { status: 500 });
  }
}

export const POST = GET; // allow POST trigger with same handler
