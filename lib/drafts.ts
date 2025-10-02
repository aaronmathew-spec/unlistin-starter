// lib/drafts.ts
export type DraftEvidence = {
  url: string; // must be allowlisted
  note?: string; // already redacted; extra context
};

export type DraftContext = {
  namePreview?: string; // redacted, e.g., "A•"
  emailPreview?: string; // redacted, e.g., "al••@g••.com" or "a•@•"
  cityPreview?: string; // redacted, e.g., "M•"
  exposureNotes?: string[]; // short, already redacted
};

export type DraftPreferences = {
  attachmentsAllowed?: boolean;
  replyEmailPreview?: string; // redacted address only
  replyChannel?: "email" | "portal" | "phone";
};

export type DraftRemovalRequest = {
  broker: string; // e.g., "Justdial"
  category?: "directory" | "broker" | "social" | "search";
  locale?: string; // default en-IN
  intent?: "remove_or_correct" | "remove" | "correct";
  context: DraftContext;
  evidence?: DraftEvidence[];
  preferences?: DraftPreferences;
};

export type DraftRemovalResponse = {
  ok: boolean;
  draft?: {
    subject: string;
    body: string;
    fields: {
      action: "remove" | "correct" | "remove_or_correct";
      data_categories: string[];
      legal_basis: string;
      reply_to_hint: string;
    };
    attachments: Array<{
      name: string;
      kind: string; // e.g., "screenshot", "pdf"
      rationale: string;
    }>;
  };
  error?: string;
};
