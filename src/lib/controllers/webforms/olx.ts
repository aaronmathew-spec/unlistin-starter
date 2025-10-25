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
  if (await topic.isVisible()) {
    // Find an <option> whose text matches /privacy|data/i and select by its value
    const candidate = topic.locator("option", { hasText: /privacy|data/i }).first();
    if (await candidate.isVisible()) {
      const val = await candidate.getAttribute("value");
      if (val) {
        await topic.selectOption(val);
      }
    }
  }

  const email = page.getByLabel(/email/i);
  if (await email.isVisible()) {
    await email.fill(args.subjectEmail ?? "");
  }

  const desc =
    page.getByLabel(/description|details/i).or(page.getByRole("textbox"));

  if (await desc.isVisible()) {
    const idLines = Object.entries(args.identifiers || {}).map(
      ([k, v]) => `${k}: ${v ?? ""}`,
    );
    await desc.fill(
      [
        "Right to erasure request.",
        args.subjectFullName ? `Name: ${args.subjectFullName}` : null,
        args.subjectEmail ? `Email: ${args.subjectEmail}` : null,
        idLines.length ? "Identifiers:" : null,
        ...idLines.map((s) => `• ${s}`),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const submit = page.getByRole("button", { name: /submit|send|request/i });
  if (await submit.isVisible()) {
    await submit.click();
  }

  // Small grace wait for in-page confirmation/snackbar
  await page.waitForTimeout(2000);
}
