/* eslint-disable @typescript-eslint/no-explicit-any */
import { bandFor, canAutoFollowup } from "./confidence";
import { getCapability } from "./capability";

/**
 * Shape we rely on from the `actions` table.
 * Keep fields loose to avoid schema mismatches; RLS must be enforced by caller.
 */
export type ActionRow = {
  id: string | number;
  broker?: string;
  category?: string;
  status: string;
  inserted_at: string;
  adapter?: string;
  confidence?: number;
  attempts?: number; // optional; if absent we treat as 0
  reply_channel?: string;
  reply_email_preview?: string;
};

export type FollowupCandidate = ActionRow & {
  band: "high" | "medium" | "low";
  method: "resend_email" | "resubmit_form";
  reason: string;
  nextWaitMinutes: number;
};

export function pickFollowupMethod(a: ActionRow): "resend_email" | "resubmit_form" {
  const cap = getCapability(a.adapter);
  if (cap?.supportsForm) return "resubmit_form";
  return "resend_email";
}

/**
 * Policy:
 * - Consider actions with status "sent" or "pending_response"
 * - Apply adapter-specific SLA windows:
 *   - high band: retry after 72h
 *   - medium band: retry after 120h (unless adapter allows medium autofs)
 * - Max 3 attempts per action (cap.maxFollowups overrides)
 */
export function selectFollowupCandidates(rows: ActionRow[], now = Date.now(), limit = 20): FollowupCandidate[] {
  const out: FollowupCandidate[] = [];

  for (const r of rows) {
    if (!r || !r.inserted_at) continue;
    if (r.status !== "sent" && r.status !== "pending_response") continue;

    const cap = getCapability(r.adapter);
    const band = bandFor(r.adapter, r.confidence);
    const mayAuto = canAutoFollowup(r.adapter, band);
    if (!mayAuto) continue;

    const attempts = Number.isFinite(r.attempts as any) ? Number(r.attempts) : 0;
    const maxAttempts = cap.maxFollowups ?? 3;
    if (attempts >= maxAttempts) continue;

    // Determine backoff by band or adapter overrides
    const baseH = band === "high" ? 72 : 120; // hours
    const stepH = cap.followupStepHours ?? baseH;
    const waitH = stepH * (attempts + 1); // linear backoff (1x, 2x, 3x...)
    const ageMs = now - new Date(r.inserted_at).getTime();
    const due = ageMs >= waitH * 60 * 60 * 1000;

    if (!due) continue;

    const method = pickFollowupMethod(r);
    out.push({
      ...r,
      band,
      method,
      reason: `Auto-followup (${band}) after ${waitH}h; attempts=${attempts + 1}/${maxAttempts}`,
      nextWaitMinutes: stepH * 60 * (attempts + 2),
    });

    if (out.length >= limit) break;
  }

  return out;
}
