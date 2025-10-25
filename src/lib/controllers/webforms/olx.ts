// src/lib/controllers/webforms/olx.ts
import type { Page } from "@playwright/test";
export type WebformArgs = {
  subjectFullName?: string;
  subjectEmail?: string;
  identifiers?: Record<string, string | undefined>;
};

export async function submitOlxRemoval(page: Page, args: WebformArgs): Promise<void> {
  const url = "https://help.olx.com/hc/requests/new";
  await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  page.setDefaultTimeout(30_000);

  // Minimal robust selectors (adjust as the site evolves)
  const topic = page.getByRole("combobox").first();
  if (await topic.isVisible()) await topic.selectOption({ label: /privacy|data/i });

  const email = page.getByLabel(/email/i);
  if (await email.isVisible()) await email.fill(args.subjectEmail ?? "");

  const desc = page.getByLabel(/description|details/i).or(page.getByRole("textbox"));
  if (await desc.isVisible()) {
    await desc.fill(
      `Right to erasure request.\nName: ${args.subjectFullName ?? ""}\n` +
      Object.entries(args.identifiers || {}).map(([k, v]) => `${k}: ${v ?? ""}`).join("\n")
    );
  }

  const submit = page.getByRole("button", { name: /submit|send|request/i });
  await submit.click();
  await page.waitForTimeout(2000);
}
