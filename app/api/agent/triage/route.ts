/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const TRIAGE_SYS = `You are a fast, careful triage assistant for inbound business emails.
Return a compact JSON with fields:
- type: one of ["otp","lead","support","spam","other"]
- vendor: short source string if obvious (e.g., "justdial","indiamart","gmail","unknown")
- confidence: 0..1
- summary: single-sentence summary.
- request_hint: numeric id if present, else null
If OTP is present, include a 6..8 digit "otp" field.`;

export async function POST(req: NextRequest) {
  try {
    const db = serverDB();
    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

    // grab newest un-triaged mail (meta.type missing)
    const { data: mails, error } = await db
      .from("mail_intake")
      .select("id, from, to, subject, body_text, correlation_hint, created_at, meta")
      .is("meta->>type", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!mails?.length) return NextResponse.json({ ok: true, triaged: 0 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    let triaged = 0;
    for (const m of mails) {
      const prompt = `FROM: ${m.from}\nTO: ${m.to}\nSUBJECT: ${m.subject}\n\n${m.body_text}`;
      const chat = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: TRIAGE_SYS },
          { role: "user", content: prompt }
        ]
      });

      let parsed: any = {};
      try {
        const content = chat.choices?.[0]?.message?.content || "{}";
        parsed = JSON.parse(content);
      } catch {
        parsed = { type: "other", vendor: "unknown", confidence: 0.3, summary: "parse error", request_hint: m.correlation_hint ?? null };
      }

      // persist minimal triage summary into meta
      const { error: upErr } = await db
        .from("mail_intake")
        .update({
          meta: {
            ...(m.meta || {}),
            type: parsed.type || "other",
            vendor: parsed.vendor || "unknown",
            confidence: parsed.confidence ?? 0.4,
            summary: parsed.summary || "",
            request_hint: parsed.request_hint ?? (m.correlation_hint || null),
            otp: parsed.otp || null
          }
        })
        .eq("id", m.id);

      if (!upErr) triaged += 1;
    }

    return NextResponse.json({ ok: true, triaged });
  } catch (e: any) {
    console.error("agent.triage error", e);
    return NextResponse.json({ error: e?.message ?? "triage failed" }, { status: 500 });
  }
}
