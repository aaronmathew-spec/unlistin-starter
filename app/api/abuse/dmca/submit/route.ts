// app/api/abuse/dmca/submit/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "";

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as any;
    const reporter_email = String(data.reporter_email || "").trim();
    const reporter_name = String(data.reporter_name || "").trim();
    const work_description = String(data.work_description || "").trim();
    const infringing_urls = Array.isArray(data.infringing_urls)
      ? data.infringing_urls.map((u: any) => String(u))
      : [];
    const signature = String(data.signature || "").trim();

    if (!work_description || !infringing_urls.length) {
      return bad(400, "missing_required_fields");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: row, error } = await sb
      .from("dmca_notices")
      .insert({
        reporter_email,
        reporter_name,
        work_description,
        infringing_urls,
        signature,
        status: "received",
      })
      .select("*")
      .single();
    if (error) return bad(400, error.message);

    if (RESEND_API_KEY && EMAIL_FROM) {
      const resend = new Resend(RESEND_API_KEY);
      await resend.emails.send({
        from: EMAIL_FROM,
        to: reporter_email || EMAIL_FROM,
        subject: `DMCA notice received · ${row.id}`,
        text: [
          `Hi ${reporter_name || "there"},`,
          ``,
          `We received your DMCA notice (id: ${row.id}).`,
          `Items:`,
          ...infringing_urls.map((u: string) => ` - ${u}`),
          ``,
          `We’ll review and contact relevant controllers where applicable.`,
        ].join("\n"),
      });
    }

    return NextResponse.json({ ok: true, id: row.id });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[dmca.submit.error]", String(e?.message || e));
    return bad(500, "internal_error");
  }
}
