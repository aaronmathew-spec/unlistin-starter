// lib/webform/handlers/olx.ts
import type { WebformHandler, WebformJobInput, WebformResult } from "./types";
import type { Page } from "@playwright/test";

/**
 * Conservative OLX handler.
 * v1: navigate to public help/privacy pages, wait for stable content,
 * capture HTML + screenshot, naive ticket/reference scrape.
 */

const DEFAULT_OLX_URL = "https://www.olx.in/help/"; // stable help hub

const CANDIDATE_URLS: string[] = [
  DEFAULT_OLX_URL,
  "https://help.olx.com/hc/en-us/requests/new",
  "https://help.olx.com/hc/en-us/categories/203850648-Privacy",
];

function extractTicketId(s: string): string | null {
  const re = /(ticket|reference|case)[\s#:]*([A-Z0-9\-\_]{6,30})/i;
  const m = s?.match?.(re);
  return m?.[2] || null;
}

async function bestUrl(job: WebformJobInput): Promise<string> {
  const explicit = (job.formUrl ?? "").trim();
  if (explicit.length > 0) return explicit;
  return CANDIDATE_URLS[0] || DEFAULT_OLX_URL;
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

export const OlxHandler: WebformHandler = {
  key: "olx",
  domains: ["olx.in", "olx.com"],
  resolveUrl: bestUrl,
  run,
};
