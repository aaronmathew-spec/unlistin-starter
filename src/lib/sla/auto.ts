// src/lib/sla/auto.ts
// Selector + helpers for SLA follow-ups & escalations (safe, additive).

export const runtime = "nodejs";

import { listDispatchLog } from "@/lib/dispatch/query";
import { getControllerEntry, type ControllerKey } from "@/src/lib/controllers/registry";
import { buildFollowupEmail, buildEscalationEmail } from "@/src/lib/email/templates/followups";
import { sendEmail } from "@/src/lib/email/send";

const FOLLOWUP_DAYS = Number(process.env.SLA_FOLLOWUP_DAYS ?? 5);
const ESCALATE_DAYS = Number(process.env.SLA_ESCALATE_DAYS ?? 15);

type DispatchRow = Awaited<ReturnType<typeof listDispatchLog>>[number];

function ageDays(isoOrDate: string | Date): number {
  const t = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const ms = Date.now() - t.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function pickControllerName(key: string | null | undefined): string {
  const k = (key || "").toLowerCase() as ControllerKey;
  try {
    return getControllerEntry(k as ControllerKey).displayName;
  } catch {
    return key || "Controller";
  }
}

function candidateReason(row: DispatchRow): "followup" | "escalate" | null {
  const d = ageDays(row.created_at);
  if (d >= ESCALATE_DAYS) return "escalate";
  if (d >= FOLLOWUP_DAYS) return "followup";
  return null;
}

/**
 * Decide the "to" recipients:
 *  - explicit override wins
 *  - registry contacts if present
 *  - otherwise, null (caller should skip or handle)
 */
function resolveRecipients(
  controller: ControllerKey | string,
  explicit?: string | string[] | null,
): string[] | null {
  if (explicit && (Array.isArray(explicit) ? explicit.length > 0 : true)) {
    return Array.isArray(explicit) ? explicit : [explicit];
  }
  try {
    const entry = getControllerEntry(controller as ControllerKey);
    if (entry?.contacts?.emails?.length) return entry.contacts.emails;
  } catch {
    // unknown controller; ignore
  }
  return null;
}

export type AutoSlaInput = {
  /** Limit rows fetched from log; default 1000 */
  limit?: number;
  /** Only act for these controllers (optional) */
  controllers?: string[];
  /** Force a specific region key like "IN", "EU", "US-CA" (optional; defaults to "EU") */
  region?: string;
  /** If provided, use this 'to' for all emails (overrides registry) */
  to?: string | string[] | null;
  /** Dry-run: true (default) = only preview; false = actually send */
  dryRun?: boolean;
};

export type AutoSlaOutcome = {
  scanned: number;
  considered: number;
  sent: number;
  escalated: number;
  skipped: Array<{ id?: string | null; controller: string; reason: string }>;
  results: Array<{
    controller: string;
    action: "followup" | "escalate";
    to: string[];
    subject: string;
    ok: boolean;
    error?: string;
  }>;
};

export async function runAutoSla(input: AutoSlaInput = {}): Promise<AutoSlaOutcome> {
  const limit = typeof input.limit === "number" ? Math.max(1, input.limit) : 1000;
  const allowSet = new Set((input.controllers || []).map((s) => s.toLowerCase()));
  const region = input.region || "EU";
  const dry = input.dryRun !== false; // default: true (dry-run)

  let rows: DispatchRow[] = [];
  try {
    rows = await listDispatchLog(limit);
  } catch {
    rows = [];
  }

  const skipped: AutoSlaOutcome["skipped"] = [];
  const results: AutoSlaOutcome["results"] = [];
  let considered = 0;
  let sent = 0;
  let escalated = 0;

  for (const r of rows) {
    // Only look at unsuccessful rows
    if (r.ok) continue;

    const reason = candidateReason(r);
    if (!reason) continue;

    const controllerKey = (r.controller_key || "").toLowerCase();
    if (allowSet.size && !allowSet.has(controllerKey)) continue;

    considered++;

    const to = resolveRecipients(controllerKey, input.to);
    if (!to) {
      skipped.push({ id: r.provider_id ?? null, controller: controllerKey, reason: "no_recipient" });
      continue;
    }

    // Basic identity hints (best-effort; logs may not have all)
    const controllerName = pickControllerName(controllerKey);
    const ticketId = r.provider_id || undefined;

    const args = {
      controllerName,
      region,
      subjectFullName: undefined,
      subjectEmail: undefined,
      subjectPhone: undefined,
      ticketId,
      daysElapsed: ageDays(r.created_at),
    } as const;

    const { subject, body } =
      reason === "escalate" ? buildEscalationEmail(args) : buildFollowupEmail(args);

    if (dry) {
      results.push({ controller: controllerKey, action: reason, to, subject, ok: true });
      if (reason === "escalate") escalated++;
      continue;
    }

    try {
      const res = await sendEmail({ to, subject, text: body });
      results.push({ controller: controllerKey, action: reason, to, subject, ok: !!res, });
      sent++;
      if (reason === "escalate") escalated++;
    } catch (e: any) {
      results.push({
        controller: controllerKey,
        action: reason,
        to,
        subject,
        ok: false,
        error: e?.message || String(e),
      });
    }
  }

  return {
    scanned: rows.length,
    considered,
    sent,
    escalated,
    skipped,
    results,
  };
}
