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
import { pickHandler } from "@/lib/webform/handlers";
import type { WebformJobInput } from "@/lib/webform/handlers";

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

  const payload: WebformJobInput = {
    controllerKey: job.controller_key,
    controllerName: job.controller_name,
    subject: { name: job.subject_name, email: job.subject_email, phone: job.subject_phone },
    locale: (job.locale as "en" | "hi") || "en",
    draft: { subject: job.draft_subject, bodyText: job.draft_body },
    formUrl: job.form_url,
  };

  const handler = pickHandler(payload);

  // eslint-disable-next-line no-console
  console.info("[worker.claimed]", redactForLogs({ id: job.id, controller: job.controller_key, handler: handler?.key ?? "generic" }));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    let html: string | undefined;
    let screenshotBase64: string | undefined;
    let ticket: string | null | undefined;

    if (handler) {
      const res = await handler.run(page, payload);
      if (res.ok) {
        html = res.html;
        screenshotBase64 = res.screenshotBase64;
        ticket = res.controllerTicketId ?? null;
      } else {
        await browser.close();
        await completeJobFailure(job.id, res.error);
        return NextResponse.json({ ok: false, id: job.id, error: res.error }, { status: 500 });
      }
    } else {
      // Fallback: open provided URL or a neutral landing and capture
      const url = payload.formUrl || "https://google.com/";
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      html = (await page.content()).slice(0, 250_000);
      const buf = await page.screenshot({ fullPage: true });
      screenshotBase64 = buf.toString("base64");
      ticket = null;
    }

    await browser.close();

    await completeJobSuccess(job.id, {
      html,
      screenshotBytesBase64: screenshotBase64,
      controllerTicketId: ticket || undefined,
    });

    return NextResponse.json({ ok: true, id: job.id, ticket: ticket || null });
  } catch (err: any) {
    await completeJobFailure(job.id, err);
    await browser.close();
    // eslint-disable-next-line no-console
    console.error("[worker.error]", redactForLogs({ id: job.id, error: String(err?.message || err) }));
    return NextResponse.json({ ok: false, id: job.id, error: String(err?.message || err) }, { status: 500 });
  }
}
