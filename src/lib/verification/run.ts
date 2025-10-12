// src/lib/verification/run.ts
import { chromium } from "playwright";
import crypto from "crypto";

export async function capture(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

  const screenshot = await page.screenshot({ fullPage: true });
  const dom = await page.content();

  await browser.close();

  return {
    screenshot,
    dom,
    screenshotHash: crypto.createHash("sha256").update(screenshot).digest("hex"),
    domHash: crypto.createHash("sha256").update(dom).digest("hex"),
  };
}
