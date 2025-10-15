// lib/webform/types.ts
export type WebformJobStatus = "queued" | "running" | "success" | "failed";

export type EnqueueWebformInput = {
  controllerKey: string;
  controllerName: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale: "en" | "hi";
  draft: { subject: string; bodyText: string };
  formUrl?: string; // optional, when known
};

export type WebformJob = {
  id: string;
  status: WebformJobStatus;
};
