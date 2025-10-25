// src/lib/controllers/webforms/truecaller.ts
/* Playwright webform shim: Truecaller removal.
   Keep selectors resilient; worker will import this module. */

import type { Page } from "@playwright/test";

export type WebformArgs = {
  subjectFullName?: string;
  subjectEmail?: string;
  subjectPhone?: string;
  countryCode?: string; // "IN", "US", ...
  reason?: string;
  identifiers?: Record<string, string | undefined>;
};

export async function submitTruecallerRemoval(page: Page, args: WebformArgs): Promise<void> {
  // Example URL; adjust via controllers_meta.form_url if you centralize later
  const url = "https://www.truecaller.com/privacy-center/request/remove";
  await page.goto(url, { waitUntil: "load", timeout: 60_000 });

  // Sane timeouts
  page.setDefaultTimeout(30_000);

  // Locators (use robust contains/labels where possible)
  const name = page.getByLabel(/full name/i);
  const phone = page.getByLabel(/phone/i).or(page.locator('input[type="tel"]'));
  const email = page.getByLabel(/email/i);
  const reason = page.getByLabel(/reason/i).or(page.getByRole("textbox", { name: /reason/i }));

  if (await name.isVisible()) await name.fill(args.subjectFullName ?? "");
  if (await phone.isVisible()) await phone.fill(args.subjectPhone ?? "");
  if (await email.isVisible()) await email.fill(args.subjectEmail ?? "");
  if (await reason.isVisible()) await reason.fill(args.reason ?? "Right to erasure request");

  // Potential captcha; we let the worker’s safety harness handle waits/retries
  const submit = page.getByRole("button", { name: /submit|send|request/i });
  await submit.click();

  // Wait for some confirmation state
  await page.waitForTimeout(2000);
}
