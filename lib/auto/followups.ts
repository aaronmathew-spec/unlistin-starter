/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Shape of an Action row we use for follow-up selection.
 * Keep this liberal because Supabase rows may include extra columns,
 * and some columns are optional depending on migrations.
 */
export type ActionRow = {
  id: string | number;
  broker: string;
  category?: string;

  status: "prepared" | "sent" | "completed" | string;

  // Redacted identity + evidence (usually arrays/objects)
  redacted_identity?: any;
  evidence?: Array<{ url: string; note?: string }> | any[];

  // Draft content (redacted in DB or safe by policy)
  draft_subject?: string | null;
  draft_body?: string | null;
  fields?: any;

  // Reply channel hints
  reply_channel?: string | null;
  reply_email_preview?: string | null;

  // Proof-of-action
  proof_hash?: string;
  proof_sig?: string;

  // Adapter metadata
  adapter?: string;
  meta?: any;

  // --- Optional columns some flows use ---
  attempts?: number;
  scheduled?: boolean;
  due_at?: string | null;     // ISO string when a follow-up is due
  created_at?: string | null; // ISO timestamps from Supabase
  updated_at?: string | null; // ISO timestamps from Supabase

  // Optional reason (used by the API route or selector to carry context)
  reason?: string;
};

/**
 * Deterministic tie-breaker for sorting when no due_at is provided.
 * Falls back through updated_at -> created_at -> id.
 */
function numericSortKey(r: ActionRow): number {
  const k =
    (r.updated_at && Date.parse(r.updated_at)) ||
    (r.created_at && Date.parse(r.created_at)) ||
    0;

  let idNum = 0;
  if (typeof r.id === "number") {
    idNum = r.id;
  } else if (typeof r.id === "string") {
    for (let i = 0; i < r.id.length; i++) {
      idNum = (idNum * 33 + r.id.charCodeAt(i)) | 0;
    }
  }
  return k ^ idNum;
}

/**
 * Options to fine-tune selection (kept optional so existing callers don't break).
 */
type FollowupSelectOpts = {
  /** Only consider rows whose (now - lastUpdate) >= this many ms. Default: 24h if provided, else no extra age gate. */
  minAgeMs?: number;
  /** Skip rows whose attempts >= maxAttempts (if attempts column is present). */
  maxAttempts?: number;
  /** If true, only select email channel (treat null as email). Default: false (no extra filter). */
  emailOnly?: boolean;
};

/**
 * Returns a trimmed, sorted list of rows that are eligible for a follow-up “nudge”.
 * - Honors `scheduled === true` (skip already scheduled).
 * - If `due_at` is present, requires it to be <= now.
 * - By default, only actions with status "sent" are eligible.
 * - Optional: apply age and attempts gates (opts).
 * - Limits the result length and keeps ordering stable.
 *
 * Keep this function pure; DB writes happen in the API route.
 */
export function selectFollowupCandidates(
  rows: ActionRow[],
  nowMs: number,
  limit = 10,
  opts?: FollowupSelectOpts
): ActionRow[] {
  const max = Math.max(1, Math.min(50, Number.isFinite(limit) ? Number(limit) : 10));
  const minAgeMs =
    typeof opts?.minAgeMs === "number" && Number.isFinite(opts.minAgeMs) && opts.minAgeMs >= 0
      ? opts.minAgeMs
      : undefined;
  const maxAttempts =
    typeof opts?.maxAttempts === "number" && Number.isFinite(opts.maxAttempts)
      ? opts.maxAttempts
      : undefined;
  const emailOnly = !!opts?.emailOnly;

  const eligible = rows
    .filter((r) => {
      // Base gates
      if (r.status !== "sent") return false;
      if (r.scheduled === true) return false;
      if (r.meta && (r.meta.noFollowup === true || r.meta.blockFollowup === true)) return false;

      // Optional channel gate (treat null as email)
      if (emailOnly) {
        const rc = (r.reply_channel || "email").toLowerCase();
        if (rc !== "email") return false;
      }

      // due_at gate
      if (r.due_at) {
        const due = Date.parse(r.due_at);
        if (!Number.isFinite(due) || due > nowMs) return false;
      }

      // optional age gate
      if (typeof minAgeMs === "number") {
        const last =
          (r.updated_at && Date.parse(r.updated_at)) ||
          (r.created_at && Date.parse(r.created_at)) ||
          NaN;
        if (!Number.isFinite(last)) return false;
        const age = nowMs - last;
        if (age < minAgeMs) return false;
      }

      // optional attempts gate
      if (typeof maxAttempts === "number") {
        const attempts = Number.isFinite(r.attempts as any) ? Number(r.attempts) : 0;
        if (attempts >= maxAttempts) return false;
      }

      return true;
    })
    .map((r) => {
      // decorate a human-ish reason string (purely informational)
      const reasons: string[] = [];

      if (r.due_at) {
        const due = Date.parse(r.due_at);
        if (Number.isFinite(due)) reasons.push(`due<=now:${new Date(due).toISOString()}`);
      }

      if (typeof minAgeMs === "number") {
        const last =
          (r.updated_at && Date.parse(r.updated_at)) ||
          (r.created_at && Date.parse(r.created_at)) ||
          NaN;
        if (Number.isFinite(last)) {
          const ageHrs = Math.floor((nowMs - last) / 3600000);
          reasons.push(`age>=${Math.floor(minAgeMs / 3600000)}h:${ageHrs}h`);
        }
      }

      if (typeof maxAttempts === "number") {
        const attempts = Number.isFinite(r.attempts as any) ? Number(r.attempts) : 0;
        reasons.push(`attempts<${maxAttempts}:${attempts}`);
      }

      if (emailOnly) {
        reasons.push("channel:email");
      }

      return { ...r, reason: reasons.length ? reasons.join(" ") : r.reason };
    });

  // Sort by:
  //  1) earliest due_at first (missing due_at goes last)
  //  2) most recently touched (updated_at/created_at) LAST — i.e., older first
  //  3) stable numeric-ish tiebreaker
  eligible.sort((a, b) => {
    const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    const aRec =
      (a.updated_at && Date.parse(a.updated_at)) ||
      (a.created_at && Date.parse(a.created_at)) ||
      0;
    const bRec =
      (b.updated_at && Date.parse(b.updated_at)) ||
      (b.created_at && Date.parse(b.created_at)) ||
      0;
    if (aRec !== bRec) return aRec - bRec; // older first

    return numericSortKey(a) - numericSortKey(b);
  });

  return eligible.slice(0, max);
}
