// lib/dispatch/delivery.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

type ResendEvent =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.opened"
  | "email.clicked"
  | "email.complained"
  | "email.failed";

export type ResendWebhook = {
  type: ResendEvent;
  created_at: string;
  data: {
    email_id: string;
    from?: string;
    to?: string[];                 // array in Resend sample payloads
    subject?: string;
    bounce?: { message?: string; subType?: string; type?: string };
    failed?: { reason?: string };
    click?: { link?: string; userAgent?: string; ipAddress?: string; timestamp?: string };
    tags?: Record<string, string | number | boolean>;
    // other fields not strictly required here
  };
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // NOTE: your repo uses SUPABASE_SERVICE_ROLE (dispatch/query.ts)
  // but other files use SUPABASE_SERVICE_ROLE_KEY. We support both.
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!url || !key) throw new Error("Missing Supabase admin env");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Map event -> ok + note
function normalizeEvent(evt: ResendEvent): { ok: boolean; note: string } {
  switch (evt) {
    case "email.sent":
      return { ok: true, note: "sent" };
    case "email.delivered":
      return { ok: true, note: "delivered" };
    case "email.opened":
      return { ok: true, note: "opened" };
    case "email.clicked":
      return { ok: true, note: "clicked" };
    case "email.delivery_delayed":
      return { ok: false, note: "delivery_delayed" };
    case "email.bounced":
      return { ok: false, note: "bounced" };
    case "email.complained":
      return { ok: false, note: "complained" };
    case "email.failed":
      return { ok: false, note: "failed" };
    default:
      return { ok: false, note: "unknown" };
  }
}

/**
 * Write a delivery/audit row tied to the originating request whenever possible.
 * We attempt to find an existing dispatch_log row with the same provider_id (Resend email_id)
 * and copy its dedupe/controller/subject context so your ops views stay consistent.
 */
export async function recordResendDelivery(payload: ResendWebhook): Promise<void> {
  const supa = admin();
  const providerId = payload?.data?.email_id || "";
  if (!providerId) return;

  // Try to reuse context from an existing row (sent) that stored provider_id
  const { data: seed } = await supa
    .from("dispatch_log")
    .select(
      "dedupe_key, controller_key, subject_email, subject_phone, subject_name, locale",
    )
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { ok, note } = normalizeEvent(payload.type);

  const subject_email = payload?.data?.to?.[0] || seed?.subject_email || null;
  const subject_name = seed?.subject_name || null;
  const subject_phone = seed?.subject_phone || null;
  const locale = (seed?.locale as "en" | "hi") || "en";

  // Build a friendly error for bounced/failed
  const error =
    payload.type === "email.bounced"
      ? payload?.data?.bounce?.message || "bounce"
      : payload.type === "email.failed"
      ? (payload?.data as any)?.failed?.reason || "failed"
      : null;

  await supa.from("dispatch_log").insert({
    dedupe_key: seed?.dedupe_key || `provider:email:${providerId}`,
    controller_key: seed?.controller_key || "generic",
    subject_email,
    subject_phone,
    subject_name,
    locale,
    channel: "email",
    provider_id: providerId,
    ok,
    error,
    note, // e.g., delivered / opened / bounced
  });
}
