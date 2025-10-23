// src/lib/dispatch/types.ts

export type LocaleShort = "en" | "hi";
export type LocaleFull = string; // e.g., "en-IN", "hi-IN"

export type SubjectProfile = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  handle?: string | null;
  // tolerate unknowns (city, etc.) without exploding
  [k: string]: unknown;
};

export type ControllerRequestInput = {
  controllerKey: string;
  controllerName: string;
  subject: SubjectProfile;
  locale?: LocaleShort | LocaleFull | null;
  draft?: { subject?: string | null; bodyText?: string | null };
  formUrl?: string | null;
  action?: string | null;
  subjectId?: string | null;
  preferredChannelOverride?: "webform" | "email" | "api";
};

export type SendResult = {
  ok: boolean;
  channel: "webform" | "email" | "api" | "noop";
  providerId?: string | null;
  error?: string | null;
  note?: string | null;
  idempotent?: "deduped" | "new";
};
