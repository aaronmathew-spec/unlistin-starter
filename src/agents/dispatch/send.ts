// src/agents/dispatch/send.ts
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

// Backoff helpers
const MIN_RETRY_MIN = Number(process.env.DISPATCH_MIN_RETRY_MINUTES || 15);
const MAX_RETRY_MIN = Number(process.env.DISPATCH_MAX_RETRY_MINUTES || 180);
const CONCURRENCY = Math.max(1, Number(process.env.DISPATCH_CONCURRENCY || 5));

// Optional mail transport
function getTransport() {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  return nodemailer.createTransport(url);
}

type ActionRow = {
  id: string;
  subject_id: string;
  controller_id: string | null;
  channel: "email" | "phone" | "webform" | "api" | "legal_letter" | "portal" | "other";
  to: string | null;
  status: "draft" | "sent" | "escalate_pending" | "escalated" | "needs_review" | "verified";
  payload: any;
  meta: any;
  retry_count: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  throttle_key: string | null;
  delivery_log: any[] | null;
  verification_info?: any;
};

function nowISO() {
  return new Date().toISOString();
}

function clamp(min: number, val: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function computeBackoff(retryCount: number) {
  // linear + jitter (minutes)
  const base = MIN_RETRY_MIN + retryCount * 20;
  const jitter = Math.floor(Math.random() * 10);
  const minutes = clamp(MIN_RETRY_MIN, base + jitter, MAX_RETRY_MIN);
  const next = new Date(Date.now() + minutes * 60_000);
  return next.toISOString();
}

function throttleKeyFor(a: ActionRow) {
  // per-domain throttle for email/webform/portal
  try {
    if (a.channel === "email" && a.to) {
      const m = a.to.split("@")[1] || "";
      return `domain:${m.toLowerCase()}`;
    }
    if ((a.channel === "webform" || a.channel === "portal") && a.to) {
      const u = new URL(a.to);
      return `domain:${u.hostname.toLowerCase()}`;
    }
  } catch {}
  return "domain:generic";
}

function setSLAs(a: ActionRow) {
  const svc = a?.meta?.serviceLevels || {};
  const ackH = typeof svc.acknowledgementHours === "number" ? svc.acknowledgementHours : 72;
  const respD = typeof svc.responseDays === "number" ? svc.responseDays : 30;
  const delD = typeof svc.deletionDays === "number" ? svc.deletionDays : 45;

  const t = Date.now();
  const ack = new Date(t + ackH * 60 * 60 * 1000).toISOString();
  const resp = new Date(t + respD * 24 * 60 * 60 * 1000).toISOString();
  const del = new Date(t + delD * 24 * 60 * 60 * 1000).toISOString();
  return { ack, resp, del };
}

async function appendDeliveryLog(actionId: string, entry: any) {
  // Read current
  let currentLog: any[] = [];
  try {
    const { data } = await db
      .from("actions")
      .select("delivery_log")
      .eq("id", actionId)
      .single();
    currentLog = (data?.delivery_log ?? []) as any[];
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("[dispatch] delivery_log read failed:", e?.message || e);
  }

  const next = [...currentLog, entry];

  try {
    await db.from("actions").update({ delivery_log: next }).eq("id", actionId);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("[dispatch] delivery_log update failed:", e?.message || e);
  }

  // Best-effort mirror row (optional table)
  try {
    await db
      .from("action_deliveries")
      .insert({
        action_id: actionId,
        attempt: entry.attempt ?? 0,
        channel: entry.channel ?? "unknown",
        status: entry.status ?? "info",
        info: entry,
      })
      .select("*")
      .maybeSingle();
  } catch {
    // table may not exist; ignore
  }
}

// --- Channel senders -------------------------------------------------------

async function sendEmail(a: ActionRow) {
  const transport = getTransport();
  const from = process.env.SENDER_EMAIL || "no-reply@unlistin.app";
  const to = a.to || "";

  if (!transport || !to) {
    // No SMTP configured — mark for retry with a preview in logs.
    return {
      ok: false as const,
      code: "NO_SMTP",
      message: "SMTP not configured or missing recipient",
      preview: { from, to, subject: a?.payload?.subject, body: a?.payload?.body },
    };
  }

  const info = await transport.sendMail({
    from,
    to,
    subject: a?.payload?.subject || `Data Deletion Request`,
    text: a?.payload?.body || "",
  });

  return { ok: true as const, providerId: info.messageId || null };
}

async function sendWebform(a: ActionRow) {
  const url = a?.payload?.url || a.to || "";
  if (!url) {
    return { ok: false as const, code: "NO_URL", message: "Missing webform URL" };
  }
  // Enqueue for worker (future): for now, simulate accepted queue.
  return { ok: true as const, queued: true };
}

async function sendPortal(a: ActionRow) {
  const url = a?.payload?.url || a.to || "";
  if (!url) {
    return { ok: false as const, code: "NO_URL", message: "Missing portal URL" };
  }
  return { ok: true as const, queued: true };
}

// --- Core dispatch ---------------------------------------------------------

async function fetchQueue(limit: number): Promise<ActionRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("actions")
    .select("*")
    .or(["status.eq.draft", `and(status.eq.escalate_pending,next_attempt_at.lte.${now})`].join(","))
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`[dispatch] queue load failed: ${error.message}`);
  return (data || []) as any;
}

export async function dispatchDraftsForSubject(subjectId: string) {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("actions")
    .select("*")
    .eq("subject_id", subjectId)
    .in("status", ["draft", "escalate_pending"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(CONCURRENCY);

  if (error) throw new Error(`[dispatch] actions fetch failed: ${error.message}`);
  const queue = (data || []) as ActionRow[];
  await processQueue(queue);
}

export async function dispatchAllDue() {
  const queue = await fetchQueue(CONCURRENCY);
  await processQueue(queue);
}

async function processQueue(queue: ActionRow[]) {
  for (const a of queue) {
    const throttle = throttleKeyFor(a);
    const attempt = (a.retry_count || 0) + 1;

    // optimistic mark attempt timestamp & throttle
    await db
      .from("actions")
      .update({
        last_attempt_at: nowISO(),
        throttle_key: throttle,
      })
      .eq("id", a.id);

    let result:
      | { ok: true; providerId?: string | null; queued?: boolean }
      | { ok: false; code: string; message: string; preview?: any };

    try {
      if (a.channel === "email") result = await sendEmail(a);
      else if (a.channel === "webform") result = await sendWebform(a);
      else if (a.channel === "portal") result = await sendPortal(a);
      else {
        result = { ok: false, code: "UNSUPPORTED_CHANNEL", message: a.channel };
      }
    } catch (err: any) {
      result = { ok: false, code: "EXCEPTION", message: err?.message || String(err) };
    }

    // finalize per result
    if (result.ok) {
      const { ack, resp, del } = setSLAs(a);
      const status =
        a.channel === "email"
          ? "sent"
          : a.channel === "webform" || a.channel === "portal"
          ? "escalate_pending"
          : "sent";

      await db
        .from("actions")
        .update({
          status,
          retry_count: 0,
          next_attempt_at: null,
          sla_ack_due_at: ack,
          sla_response_due_at: resp,
          sla_deletion_due_at: del,
          verification_info: {
            ...(a as any).verification_info,
            dispatch: {
              at: nowISO(),
              channel: a.channel,
              providerId: (result as any).providerId ?? null,
              queued: (result as any).queued ?? false,
            },
          },
        })
        .eq("id", a.id);

      await appendDeliveryLog(a.id, {
        at: nowISO(),
        attempt,
        channel: a.channel,
        status: "ok",
        detail: result,
      });
    } else {
      const next = computeBackoff(attempt);
      await db
        .from("actions")
        .update({
          status: "escalate_pending", // keep in queue for retry/escalation
          retry_count: attempt,
          next_attempt_at: next,
          verification_info: {
            ...(a as any).verification_info,
            dispatch_error: {
              at: nowISO(),
              code: (result as any).code,
              message: (result as any).message,
              preview: (result as any).preview || null,
            },
          },
        })
        .eq("id", a.id);

      await appendDeliveryLog(a.id, {
        at: nowISO(),
        attempt,
        channel: a.channel,
        status: "error",
        error: result,
        next_attempt_at: next,
      });
    }
  }
}
