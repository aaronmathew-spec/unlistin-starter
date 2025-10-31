// src/lib/webform/handlers/index.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from "@playwright/test";

/** Input the worker constructs for each job */
export type WebformJobInput = {
  controllerKey: string;
  controllerName: string;
  subject: {
    name?: string;
    email?: string;
    phone?: string;
  };
  locale: "en" | "hi";
  draft: { subject: string; bodyText: string };
  formUrl?: string;
};

export type HandlerResult =
  | { ok: true; html?: string; screenshotBase64?: string; controllerTicketId?: string | null }
  | { ok: false; error: string };

export type WebformHandler = {
  key: string;
  run: (page: Page, input: WebformJobInput) => Promise<HandlerResult>;
};

// --- Registry (empty by default; worker will fall back safely) ---
const REGISTRY = new Map<string, WebformHandler>();

/**
 * Example: registering a targeted handler in future:
 *
 * REGISTRY.set("truecaller", {
 *   key: "truecaller",
 *   run: async (page, input) => {
 *     await page.goto(input.formUrl ?? "https://www.truecaller.com/optout", { waitUntil: "domcontentloaded" });
 *     // ... do steps ...
 *     const html = await page.content();
 *     const screenshotBase64 = (await page.screenshot({ fullPage: true })).toString("base64");
 *     return { ok: true, html, screenshotBase64, controllerTicketId: null };
 *   },
 * });
 */

export function pickHandler(input: WebformJobInput): WebformHandler | null {
  const key = String(input.controllerKey || "").toLowerCase();
  return REGISTRY.get(key) ?? null;
}
