// lib/webform/handlers/types.ts
import type { Page } from "@playwright/test";

export type WebformJobInput = {
  controllerKey: string;
  controllerName: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale: "en" | "hi";
  draft: { subject: string; bodyText: string };
  formUrl?: string | null;
};

export type WebformResult = {
  ok: true;
  html?: string;
  screenshotBase64?: string;
  controllerTicketId?: string | null;
} | {
  ok: false;
  error: string;
};

export type WebformHandler = {
  /** a short key, e.g. "truecaller" */
  key: string;
  /** optional domain hints to auto-pick handler if URL contains these */
  domains?: string[];
  /** returns best form URL for this controller */
  resolveUrl: (job: WebformJobInput) => Promise<string>;
  /** fills flows; MUST be resilient (no throw); return ok:false on failures */
  run: (page: Page, job: WebformJobInput) => Promise<WebformResult>;
};
