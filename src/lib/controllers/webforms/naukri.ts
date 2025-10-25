// src/lib/controllers/webforms/naukri.ts
import type { Page } from "@playwright/test";
export type WebformArgs = {
  subjectFullName?: string;
  subjectEmail?: string;
  identifiers?: Record<string, string | undefined>;
};

export async function submitNaukriEmailFallback(_: Page, __: WebformArgs): Promise<void> {
  // Naukri is email-first in our registry; webform fallback is a no-op here.
  // Worker will route to email channel.
  return;
}
