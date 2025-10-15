// app/api/ops/email/inbound/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { redactForLogs } from "@/lib/pii/redact";

const INBOUND_SECRET = process.env.EMAIL_INBOUND_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  if (!INBOUND_SECRET) return forbidden("EMAIL_INBOUND_SECRET not configured");
  const header = req.headers.get("x-inbound-secret") || "";
  if (header !== INBOUND_SECRET) return forbidden("Invalid secret");

  const body = (await req.json().catch(() => ({}))) as any;

  const text = body?.text ?? "";
  const html = body?.html ?? "";
  const subject = body?.subject ?? "";
  const to = (body?.to ?? []).join(", ");
  const from = (body?.from ?? "");

  // Try to guess controller key (very naive; improve later)
  const controllerKey = guessControllerKey(subject + " " + html + " " + text);

  // Try to extract ticket/reference
  const ticket = extractTicketId(html || text);

  // eslint-disable-next-line no-console
  console.info("[inbound.email]", redactForLogs({ from, to, subject, controllerKey, ticket }));

  if (ticket && controllerKey) {
    // Save recent ticket to the most recent running/queued job of that controller
    const sb = srv();
    const { data, error } = await sb
      .from("webform_jobs")
      .select("id,status")
      .eq("controller_key", controllerKey)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && data?.[0]) {
      await sb
        .from("webform_jobs")
        .update({ controller_ticket_id: ticket })
        .eq("id", data[0].id);
    }
  }

  return NextResponse.json({ ok: true });
}

function extractTicketId(s: string): string | null {
  const re = /(ticket|reference)[\s#:]*([A-Z0-9\-\_]{6,30})/i;
  const m = s.match(re);
  return m?.[2] || null;
}

function guessControllerKey(s: string): string | null {
  const lower = s.toLowerCase();
  if (lower.includes("truecaller")) return "truecaller";
  if (lower.includes("naukri")) return "naukri";
  if (lower.includes("olx")) return "olx";
  if (lower.includes("foundit")) return "foundit";
  if (lower.includes("shine")) return "shine";
  if (lower.includes("timesjobs")) return "timesjobs";
  return null;
}
