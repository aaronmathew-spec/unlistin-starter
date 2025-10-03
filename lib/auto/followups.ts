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

  // Optional reason (used by the API route to carry a skip/explain message)
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
 * Returns a trimmed, sorted list of rows that are eligible for a follow-up “nudge”.
 * - Honors `scheduled === true` (skip already scheduled).
 * - If `due_at` is present, requires it to be <= now.
 * - By default, only actions with status "sent" are eligible.
 * - Limits the result length and keeps ordering stable.
 *
 * Keep this function pure; DB writes happen in the API route.
 */
export function selectFollowupCandidates(
  rows: ActionRow[],
  nowMs: number,
  limit = 10
): ActionRow[] {
  const max = Math.max(1, Math.min(50, Number.isFinite(limit) ? limit : 10));

  const eligible = rows.filter((r) => {
    if (r.status !== "sent") return false;
    if (r.scheduled === true) return false;
    if (r.meta && (r.meta.noFollowup === true || r.meta.blockFollowup === true)) return false;

    if (r.due_at) {
      const due = Date.parse(r.due_at);
      if (!Number.isFinite(due) || due > nowMs) return false;
    }

    return true;
  });

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
    if (aRec !== bRec) return bRec - aRec;

    return numericSortKey(a) - numericSortKey(b);
  });

  return eligible.slice(0, max);
}
