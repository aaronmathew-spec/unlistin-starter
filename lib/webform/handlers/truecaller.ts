// lib/webform/handlers/truecaller.ts
import type { WebformHandler, WebformJobInput, WebformResult } from "./types";
import type { Page } from "@playwright/test";

/**
 * Conservative Truecaller handler.
 * v1 goal: navigate to public unlisting/help page, wait for stable content,
 * capture HTML + screenshot, attempt a naive ticket/reference scrape.
 *
 * NOTE: This does not attempt OTP or login. It is safe and deterministic.
 */

const CANDIDATE_URLS = [
  // These may redirect; that's fine—we only need a stable page for capture.
  "https://www.truecaller.com/privacy-center/request/unlist",
  "https://www.truecaller.com/unlisting",
  "https://support.truecaller.com/hc/en-us/articles/115004177305",
];

function extractTicketId(s: string): string | null {
  const re = /(ticket|reference)[\s#:]*([A-Z0-9\-\_]{6,30})/i;
  const m = s?.match?.(re);
  return m?.[2] || null;
}

async function bestUrl(_job: WebformJobInput): Promise<string> {
  // Prefer explicit job.formUrl if provided upstream; else fall back to candidates.
  return _job.formUrl?.trim() || CANDIDATE_URLS[0];
}

async function run(page: Page, job: WebformJobInput): Promise<WebformResult> {
  try {
    const url = await bestUrl(job);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // If localized copy is desired later, you can switch language via UI here.

    // Capture artifacts
    const html = await page.content();
    const screenshot = await page.screenshot({ fullPage: true });
    const b64 = screenshot.toString("base64");

    const ticket = extractTicketId(html);
    return { ok: true, html: html.slice(0, 250_000), screenshotBase64: b64, controllerTicketId: ticket };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export const TruecallerHandler: WebformHandler = {
  key: "truecaller",
  domains: ["truecaller.com"],
  resolveUrl: bestUrl,
  run,
};
