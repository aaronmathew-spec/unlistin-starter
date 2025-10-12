/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifySlack } from "@/lib/notify";

function envBool(v?: string) {
  return v === "1" || v?.toLowerCase() === "true";
}

function serverDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function triageNow(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/agent/triage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
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

    // 1) triage
    const triage = await triageNow(base);

    // 2) select mail to open
    const { data: mails, error } = await db
      .from("mail_intake")
      .select("id, from, to, subject, body_text, created_at, meta, routed_to_request_id")
      .is("routed_to_request_id", null)
      .in("meta->>type", ["otp", "lead", "support"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let opened = 0;
    for (const m of mails ?? []) {
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

      // --- org auto-assignment (safe/no-break) -------------------------
      // Try to resolve org_id from mail_routing(to_address -> org_id).
      // If the table/column doesn't exist, or no match: we proceed without org.
      let org_id: string | null = null;
      if (m.to) {
        try {
          const rt = await db
            .from("mail_routing")
            .select("org_id")
            .eq("to_address", m.to)
            .maybeSingle();
          if (!rt.error) org_id = (rt.data as any)?.org_id ?? null;
        } catch {
          // ignore; routing table may not exist yet
        }
      }
      // -----------------------------------------------------------------

      // Create request (minimal fields first to avoid schema mismatches)
      const { data: created, error: cErr } = await db
        .from("requests")
        .insert([{ title, description, status: "new" } as any])
        .select("id")
        .maybeSingle();
      if (cErr || !created?.id) continue;

      // If we discovered an org_id, try to set it on the request (ignore if column doesn't exist)
      if (org_id) {
        try {
          await db.from("requests").update({ org_id } as any).eq("id", created.id);
        } catch {
          // ignore — safe if requests.org_id doesn't exist
        }
      }

      // Link mail -> request; also persist org_id on mail row if we have it (ignore if column missing)
      const mailUpdate: any = { routed_to_request_id: created.id };
      if (org_id) mailUpdate.org_id = org_id;

      const { error: uErr } = await db.from("mail_intake").update(mailUpdate).eq("id", m.id);
      if (uErr) {
        // As a fallback, at least set the link if the org column caused the error
        if (org_id) {
          try {
            await db
              .from("mail_intake")
              .update({ routed_to_request_id: created.id } as any)
              .eq("id", m.id);
          } catch {
            /* ignore */
          }
        }
      }

      opened += 1;

      // 🔔 Slack notice (best-effort)
      const v = (m.meta?.type as string) || "unknown";
      const vendor = (m.meta?.vendor as string) || "unknown";
      const link = `${base}/requests/${created.id}/verify`;
      notifySlack(`🆕 Opened request *${created.id}* (${v}/${vendor}) — <${link}|Verify OTP>`);
    }

    return NextResponse.json({
      ok: true,
      triage_status: triage.status,
      triaged: triage.json?.triaged ?? null,
      opened,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "auto-intake failed" }, { status: 500 });
  }
}

export const POST = GET;
