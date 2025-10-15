// lib/webform/handlers/shine.ts
import type { WebformHandler, WebformJobInput, WebformResult } from "./types";
import type { Page } from "@playwright/test";

/**
 * Conservative Shine handler.
 * v1: navigate to privacy/help page, capture artifacts, naive ticket scrape.
 */

const DEFAULT_SHINE_URL = "https://www.shine.com/privacy-policy/";

const CANDIDATE_URLS: string[] = [
  DEFAULT_SHINE_URL,
  "https://www.shine.com/terms-conditions/",
  "https://learning.shine.com/t/contact-us",
];

function extractTicketId(s: string): string | null {
  const re = /(ticket|reference|case)[\s#:]*([A-Z0-9\-\_]{6,30})/i;
  const m = s?.match?.(re);
  return m?.[2] || null;
}

async function bestUrl(job: WebformJobInput): Promise<string> {
  const explicit = (job.formUrl ?? "").trim();
  if (explicit.length > 0) return explicit;
  return CANDIDATE_URLS[0] || DEFAULT_SHINE_URL;
}

async function run(page: Page, job: WebformJobInput): Promise<WebformResult> {
  try {
    const url = await bestUrl(job);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const html = await page.content();
    const screenshot = await page.screenshot({ fullPage: true });
    const b64 = screenshot.toString("base64");

    const ticket = extractTicketId(html);
    return { ok: true, html: html.slice(0, 250_000), screenshotBase64: b64, controllerTicketId: ticket };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export const ShineHandler: WebformHandler = {
  key: "shine",
  domains: ["shine.com"],
  resolveUrl: bestUrl,
  run,
};
