/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { chromium } from "@playwright/test";
import {
  claimNextJob,
  completeJobFailure,
  completeJobSuccess,
} from "@/lib/webform/queue";
import type { WebformJob } from "@/lib/webform/queue";
import { redactForLogs } from "@/lib/pii/redact";
import { pickHandler } from "@/lib/webform/handlers";
import type { WebformJobInput } from "@/lib/webform/handlers";

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();

/** 403 helper */
function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

/** Tune: how many jobs to try per pulse */
const MAX_JOBS_PER_PULSE = 3;

/** Safe string coerce with fallback */
function str(v: any, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

/** "en" | "hi" with fallback to "en" */
function asLocale(v: any): "en" | "hi" {
  const s = str(v).toLowerCase();
  return s === "hi" ? "hi" : "en";
}

export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = (req.headers.get("x-secure-cron") || "").trim();
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  // Try to claim first job. If none, quick no-op.
  const first = await claimNextJob();
  if (!first) return NextResponse.json({ ok: true, message: "no_jobs" });

  // Launch a single browser for this pulse and reuse pages
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();

  let processed = 0;
  let lastId: string | null = null;

  try {
    // Process the first + up to N-1 more
    let current: WebformJob | null = first;

    while (current && processed < MAX_JOBS_PER_PULSE) {
      const job = current;
      lastId = job.id;

      // Pull meta for fallbacks
      const meta = (job as any).meta ?? {};

      // Coerce strict strings and provide sensible fallbacks from meta
      const controllerKey = str(
        (job as any).controller_key ?? meta.controllerKey ?? meta.siteKey ?? ""
      );
      const controllerName = str(
        (job as any).controller_name ?? meta.controllerName ?? meta.siteName ?? controllerKey
      );

      const subject_name = str(
        (job as any).subject_name ?? meta.subjectName ?? meta.name ?? ""
      );
      const subject_email = str(
        (job as any).subject_email ?? meta.subjectEmail ?? meta.email ?? ""
      );
      const subject_phone = str(
        (job as any).subject_phone ?? meta.subjectPhone ?? meta.phone ?? ""
      );

      const locale = asLocale((job as any).locale ?? meta.locale ?? "en");

      const draft_subject = str(
        (job as any).draft_subject ?? meta.draftSubject ?? meta.subject ?? ""
      );
      const draft_body = str(
        (job as any).draft_body ?? meta.draftBody ?? meta.bodyText ?? meta.body ?? ""
      );

      const formUrlRaw =
        (job as any).form_url ?? meta.formUrl ?? meta.url ?? (job as any).url;
      const formUrl = str(formUrlRaw || "");

      const payload: WebformJobInput = {
        controllerKey,
        controllerName,
        subject: {
          name: subject_name || undefined,
          email: subject_email || undefined,
          phone: subject_phone || undefined,
        },
        locale,
        // draft fields coerced to strings above to satisfy typing
        draft: {
          subject: draft_subject,
          bodyText: draft_body,
        },
        // formUrl remains optional in your handler type
        formUrl: formUrl || undefined,
      };

      const handler = pickHandler(payload);

      // eslint-disable-next-line no-console
      console.info(
        "[worker.claimed]",
        redactForLogs(
          {
            id: job.id,
            controller: controllerKey,
            handler: handler?.key ?? "generic",
          },
          { keys: ["email", "phone"] }
        )
      );

      const page = await ctx.newPage();

      try {
        let html: string | undefined;
        let screenshotBase64: string | undefined;
        let ticket: string | null | undefined;

        if (handler) {
          const res = await handler.run(page, payload);
          if (!res.ok) {
            await completeJobFailure(job.id, res.error);
            // eslint-disable-next-line no-console
            console.warn(
              "[worker.job_failed]",
              redactForLogs({ id: job.id, error: res.error })
            );
          } else {
            html = res.html;
            screenshotBase64 = res.screenshotBase64;
            ticket = res.controllerTicketId ?? null;
            await completeJobSuccess(job.id, {
              html,
              screenshotBytesBase64: screenshotBase64,
              controllerTicketId: ticket || undefined,
            });
            processed += 1;
          }
        } else {
          // Fallback capture: open provided URL or a neutral page and snapshot
          const url = payload.formUrl || "https://google.com/";
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          html = (await page.content()).slice(0, 250_000);
          const buf = await page.screenshot({ fullPage: true });
          screenshotBase64 = buf.toString("base64");
          ticket = null;

          await completeJobSuccess(job.id, {
            html,
            screenshotBytesBase64: screenshotBase64,
            controllerTicketId: undefined,
          });
          processed += 1;
        }
      } catch (err: any) {
        await completeJobFailure(job.id, String(err?.message || err));
        // eslint-disable-next-line no-console
        console.error(
          "[worker.error]",
          redactForLogs({ id: job.id, error: String(err?.message || err) })
        );
      } finally {
        await page.close().catch(() => {});
      }

      // Try to claim next job; break if none
      current = await claimNextJob(); // current is WebformJob | null
    }

    return NextResponse.json({
      ok: true,
      processed,
      lastId,
      note:
        processed >= MAX_JOBS_PER_PULSE
          ? `processed ${processed}; more will be picked next pulse`
          : "queue drained or no more jobs",
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(
      "[worker.fatal]",
      redactForLogs({ lastId, error: String(err?.message || err) })
    );
    return NextResponse.json(
      { ok: false, error: String(err?.message || err), processed, lastId },
      { status: 500 }
    );
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
