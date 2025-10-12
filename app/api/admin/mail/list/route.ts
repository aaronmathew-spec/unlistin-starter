/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_req: NextRequest) {
  const db = serverDB();
  // latest 50 mails, and latest otp that shares the same source_message_id if any
  const { data: mails, error } = await db
    .from("mail_intake")
    .select("id, created_at, message_id, from, to, subject, correlation_hint, routed_to_request_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // fetch otps by message_id
  const msgIds = (mails ?? []).map(m => m.message_id).filter(Boolean);
  let otpsByMsg: Record<string, any> = {};
  if (msgIds.length) {
    const { data: otps } = await db
      .from("otp_codes")
      .select("code, provider, source_message_id, created_at, meta")
      .in("source_message_id", msgIds);
    for (const o of otps ?? []) {
      const k = o.source_message_id || "";
      if (!otpsByMsg[k]) otpsByMsg[k] = [];
      otpsByMsg[k].push(o);
    }
  }

  return NextResponse.json({ mails, otpsByMsg });
}
