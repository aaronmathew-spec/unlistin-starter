/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function envBool(v?: string) {
  return v === "1" || v?.toLowerCase() === "true";
}

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Common OTP patterns (6–8 digits, sometimes separated by spaces or dashes)
// You can extend this list for site-specific formats.
const OTP_REGEXES: RegExp[] = [
  /\b(\d{6})\b/g,                           // 6 digits
  /\b(\d{7,8})\b/g,                         // 7 or 8 digits
  /\b(\d[\s-]\d[\s-]\d[\s-]\d[\s-]\d[\s-]\d)\b/g // 6 digits with separators
];

// Try to guess provider/site from sender/subject/body
function guessProvider(from: string, subject: string, body: string): string {
  const blob = `${from}\n${subject}\n${body}`.toLowerCase();
  if (blob.includes("justdial")) return "justdial";
  if (blob.includes("indiamart")) return "indiamart";
  return "generic";
}

// Return best-before from text if present (e.g. "valid for 10 minutes")
function inferExpiry(body: string): Date | null {
  const m = /valid\s+for\s+(\d{1,2})\s+min/i.exec(body);
  if (m) {
    const mins = parseInt(m[1]!, 10);
    const d = new Date();
    d.setMinutes(d.getMinutes() + Math.min(Math.max(mins, 1), 60));
    return d;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_MAILROOM)) {
      return NextResponse.json({ error: "mailroom/otp disabled" }, { status: 503 });
    }

    const db = serverDB();
    const body = await req.json().catch(() => ({})) as {
      // optional filters
      request_id?: number | string;
      since_minutes?: number; // scan recent N minutes (default 60)
      limit?: number;         // cap messages to scan (default 50)
    };

    const sinceMinutes = Math.min(Math.max(body.since_minutes ?? 60, 5), 720);
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);

    // Pull recent inbound mail
    const sinceISO = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
    const { data: mails, error } = await db
      .from("mail_intake")
      .select("id, message_id, from, subject, body_text, created_at, routed_to_request_id, correlation_hint")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: "db read failed", detail: error.message }, { status: 500 });
    }

    const found: Array<{ code: string; provider: string; message_id?: string; request_uuid?: string | null; expires_at?: string | null }> = [];

    for (const m of mails ?? []) {
      const text = `${m.subject ?? ""}\n${m.body_text ?? ""}`;
      const provider = guessProvider(m.from ?? "", m.subject ?? "", m.body_text ?? "");
      const expires = inferExpiry(text);

      for (const rx of OTP_REGEXES) {
        rx.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = rx.exec(text)) !== null) {
          const raw = match[1]!.replace(/[\s-]/g, "");
          // OTP sanity: 6-8 digits only
          if (!/^\d{6,8}$/.test(raw)) continue;

          found.push({
            code: raw,
            provider,
            message_id: m.message_id ?? undefined,
            request_uuid: (m.routed_to_request_id ?? null),
            expires_at: expires ? new Date(expires).toISOString() : null
          });
        }
      }
    }

    // Insert unique OTPs (avoid dupes by (code,message_id))
    const uniques = new Map<string, typeof found[number]>();
    for (const f of found) {
      const key = `${f.code}|${f.message_id ?? ""}`;
      if (!uniques.has(key)) uniques.set(key, f);
    }
    const rows = Array.from(uniques.values());
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, scanned: mails?.length ?? 0, matches: 0 });
    }

    const { error: insErr } = await db.from("otp_codes").insert(
      rows.map(r => ({
        org_id: null,
        request_id: r.request_uuid ?? null,
        provider: r.provider,
        code: r.code,
        expires_at: r.expires_at ? new Date(r.expires_at) : null,
        source_message_id: r.message_id ?? null,
        meta: {}
      }))
    );

    if (insErr) {
      return NextResponse.json({ error: "otp insert failed", detail: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: rows.length, scanned: mails?.length ?? 0, matches: found.length });
  } catch (e: any) {
    console.error("otp.scan error", e);
    return NextResponse.json({ error: e?.message ?? "otp scan failed" }, { status: 500 });
  }
}
