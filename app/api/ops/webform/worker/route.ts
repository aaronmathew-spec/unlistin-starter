// app/api/ops/webform/worker/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { chromium } from "@playwright/test";
import {
  claimNextJob,
  completeJobFailure,
  completeJobSuccess,
} from "@/lib/webform/queue";
import { redactForLogs } from "@/lib/pii/redact";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const job = await claimNextJob();
  if (!job) return NextResponse.json({ ok: true, message: "no_jobs" });

  // eslint-disable-next-line no-console
  console.info("[worker.claimed]", redactForLogs({ id: job.id, controller: job.controller_key }));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    const url = job.form_url || inferControllerHomepage(job.controller_key);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Simple wait for network to settle
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // TODO: per-site flows (OTP, form fill) go here in future iterations.

    // Capture artifacts
    const html = await page.content();
    const buf = await page.screenshot({ fullPage: true });
    const b64 = buf.toString("base64");

    // Naive ticket scrape
    const ticket = extractTicketId(html);

    await completeJobSuccess(job.id, {
      html: html.slice(0, 250_000), // cap to 250KB to keep row sane
      screenshotBytesBase64: b64,
      controllerTicketId: ticket || undefined,
    });

    await browser.close();

    return NextResponse.json({ ok: true, id: job.id, ticket: ticket || null });
  } catch (err: any) {
    await completeJobFailure(job.id, err);
    await browser.close();
    // eslint-disable-next-line no-console
    console.error("[worker.error]", redactForLogs({ id: job.id, error: String(err?.message || err) }));
    return NextResponse.json({ ok: false, id: job.id, error: String(err?.message || err) }, { status: 500 });
  }
}

function inferControllerHomepage(key: string): string {
  switch (key) {
    case "truecaller": return "https://www.truecaller.com/";
    case "naukri": return "https://www.naukri.com/";
    case "olx": return "https://www.olx.in/";
    case "foundit": return "https://www.foundit.in/";
    case "shine": return "https://www.shine.com/";
    case "timesjobs": return "https://www.timesjobs.com/";
    default: return "https://google.com/";
  }
}

function extractTicketId(html: string): string | null {
  // Very conservative: look for 'ticket' or 'reference' patterns
  const re = /(ticket|reference)[\s#:]*([A-Z0-9\-\_]{6,30})/i;
  const m = html.match(re);
  return m?.[2] || null;
}
