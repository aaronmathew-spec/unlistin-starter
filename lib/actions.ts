// lib/actions.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ActionStatus =
  | "draft"
  | "prepared"
  | "sent"
  | "follow_up_due"
  | "resolved"
  | "cancelled";

export type RedactedIdentity = {
  namePreview?: string;   // "N•"
  emailPreview?: string;  // "e•@•"
  cityPreview?: string;   // "C•"
};

export type ActionEvidence = {
  url: string;            // must be allowlisted
  note?: string;          // redacted only
};

export type ActionRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;       // RLS-scoped, nullable for anon (if you allow)
  broker: string;
  category: string;             // directory | broker | social | search
  status: ActionStatus;
  redacted_identity: RedactedIdentity;
  evidence: ActionEvidence[];
  draft_subject?: string;
  draft_body?: string;
  fields?: Record<string, any>; // non-PII metadata (action, legal_basis, etc.)
  reply_channel?: "email" | "portal" | "phone";
  reply_email_preview?: string | null;
  // cryptographic proof link:
  proof_hash?: string | null;   // hex
  proof_sig?: string | null;    // hex
};

export type CreateActionInput = {
  broker: string;
  category?: "directory" | "broker" | "social" | "search";
  redacted_identity: RedactedIdentity;
  evidence?: ActionEvidence[];
  draft?: {
    subject: string;
    body: string;
    fields?: Record<string, any>;
  };
  reply?: {
    channel?: "email" | "portal" | "phone";
    emailPreview?: string;
  };
};

export type UpdateActionInput = Partial<
  Pick<
    ActionRecord,
    | "status"
    | "draft_subject"
    | "draft_body"
    | "fields"
    | "reply_channel"
    | "reply_email_preview"
  >
> & {
  evidenceAppend?: ActionEvidence[];
};

export function safeNowIso() {
  return new Date().toISOString();
}
