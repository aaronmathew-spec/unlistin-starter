/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifySlack } from "@/lib/notify";
import { sendMail } from "@/lib/email";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const { within_minutes } = (await req.json().catch(() => ({}))) as { within_minutes?: number };

    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${base}/api/otp/get`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: id, within_minutes: within_minutes ?? 30 }),
    });
    const j = await res.json().catch(() => ({}));
    const code = j?.code || null;
    if (!code) return NextResponse.json({ ok: false, verified: false, reason: "no_otp" });

    // mark request verified
    const dbc = db();
    const { error } = await dbc.from("requests").update({ status: "verified" } as any).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // look up original sender via mail_intake link
    let toNotify: string | null = null;
    try {
      const { data } = await dbc
        .from("mail_intake")
        .select("from")
        .eq("routed_to_request_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      toNotify = (data?.from as string | null) ?? null;
    } catch { /* ignore */ }

    // 🔔 Slack (best-effort)
    notifySlack(`✅ Request *${id}* verified (OTP ${code}). <${base}/requests/${id}|Open request>`);

    // 📧 Email the sender (best-effort)
    if (toNotify) {
      const subj = `Your request ${id} is verified`;
      const text = `Hi,\n\nYour OTP (${code}) was verified and your request ${id} is now confirmed.\n\nThanks,\nUnlistin`;
      const html = `<p>Hi,</p><p>Your OTP (<b>${code}</b>) was verified and your request <b>${id}</b> is now confirmed.</p><p>Thanks,<br/>Unlistin</p>`;
      await sendMail({ to: toNotify, subject: subj, text, html });
    }

    return NextResponse.json({ ok: true, verified: true, code, emailed: !!toNotify });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "verify failed" }, { status: 500 });
  }
}
