// src/agents/dispatch/webformWorker.ts
import { createClient } from "@supabase/supabase-js";
import { captureAndStoreArtifacts } from "@/agents/verification/capture";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

type JobRow = {
  id: string;
  action_id: string;
  subject_id: string;
  url: string;
  payload: any;
  status: "queued" | "running" | "succeeded" | "failed";
  attempt: number;
};

function ms(n: number) {
  return new Promise((r) => setTimeout(r, n));
}

/**
 * Tries to map common fields to best-guess selectors. For world-class coverage,
 * you can expand this registry per domain in controller metadata later.
 */
const FIELD_MAP: Record<string, string[]> = {
  // logical field key => candidate CSS selectors (try in order)
  name: ["input[name*=name i]", "input#name", "input[autocomplete='name']"],
  email: ["input[type=email]", "input[name*=email i]", "input#email"],
  phone: ["input[type=tel]", "input[name*=phone i]", "input#phone"],
  message: [
    "textarea[name*=message i]",
    "textarea#message",
    "textarea",
    "input[name*=message i]",
  ],
  // GDPR/DSR text areas
  request: [
    "textarea[name*=request i]",
    "textarea[name*=dsr i]",
    "textarea[name*=gdpr i]",
  ],
};

async function fillIfPresent(page: any, selector: string, value: string) {
  const el = await page.$(selector);
  if (el) {
    await el.click({ delay: 50 });
    await el.fill(value);
    await ms(150);
    return true;
  }
  return false;
}

async function typeBest(page: any, candidates: string[], value?: string | null) {
  if (!value) return false;
  for (const sel of candidates) {
    try {
      if (await fillIfPresent(page, sel, value)) return true;
    } catch {}
  }
  return false;
}

async function clickFirst(page: any, candidates: string[]) {
  for (const sel of candidates) {
    const el = await page.$(sel);
    if (el) {
      await el.click({ delay: 80 });
      return true;
    }
  }
  return false;
}

function buildThrottleDelay(hostname: string, min = 800, max = 1600) {
  // per-domain human-like jitter
  const base = min + Math.floor(Math.random() * (max - min));
  const bonus = hostname.includes("support") || hostname.includes("help") ? 200 : 0;
  return base + bonus;
}

async function submitWebform(job: JobRow) {
  const { chromium }: any = await import("playwright"); // dynamic import to avoid build-time issues
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
  });
  const page = await context.newPage();

  const u = new URL(job.url);
  const delay = buildThrottleDelay(u.hostname);

  try {
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await ms(delay);

    const p = job.payload || {};
    await typeBest(page, FIELD_MAP.name ?? [], p.name || p.legalName || p.fullName);
    await ms(delay);
    await typeBest(page, FIELD_MAP.email ?? [], p.email);
    await ms(delay);
    await typeBest(page, FIELD_MAP.phone ?? [], p.phone);
    await ms(delay);

    const message =
      p.message ||
      p.requestText ||
      "I am exercising my right to request deletion of my personal data associated with the information provided.";
    await typeBest(page, FIELD_MAP.message ?? [], message);
    await ms(delay);

    // Look for submit buttons
    const clicked =
      (await clickFirst(page, ["button[type=submit]", "button:has-text('Submit')"])) ||
      (await clickFirst(page, ["input[type=submit]", "button:has-text('Send')"])) ||
      (await clickFirst(page, ["button:has-text('Request')", "button:has-text('Continue')"]));

    if (!clicked) {
      throw new Error("No obvious submit button found");
    }

    // wait for network/idle-ish state
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await ms(delay);

    // Best-effort confirmation capture (text + screenshot)
    const html = await page.content();
    const text = (await page.textContent("body")) || "";
    const screenshot = await page.screenshot({ fullPage: true });

    await browser.close();

    return {
      ok: true,
      confirmationText: text.slice(0, 5000),
      html,
      screenshot, // Buffer
    };
  } catch (e: any) {
    await browser.close();
    return {
      ok: false,
      error: e?.message || String(e),
    };
  }
}

export async function processNextWebformJobs(limit = 3) {
  // 1) Pick a small batch (FIFO)
  const { data: jobs, error } = await db
    .from("webform_jobs")
    .select("*")
    .eq("status", "queued")
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`[webformWorker] load queue failed: ${error.message}`);
  if (!jobs || jobs.length === 0) return { picked: 0, succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs as JobRow[]) {
    await db
      .from("webform_jobs")
      .update({ status: "running", run_at: new Date().toISOString(), attempt: (job.attempt || 0) + 1 })
      .eq("id", job.id);

    const res = await submitWebform(job);

    if (res.ok) {
      // Store artifacts via our capture layer so hashes flow into proofs
      try {
        const cap = await captureAndStoreArtifacts({
          subjectId: job.subject_id,
          actionId: job.action_id,
          url: job.url,
          // If capture layer accepts raw buffers, extend it to store `res.screenshot` & `res.html`.
        });

        await db
          .from("webform_jobs")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
            result: {
              confirmationText: res.confirmationText,
              htmlHash: cap.htmlHash,
              screenshotHash: cap.screenshotHash,
              htmlPath: cap.htmlPath,
              screenshotPath: cap.screenshotPath,
            },
          })
          .eq("id", job.id);

        // Move action forward to "sent" (it was queued as escalate_pending)
        await db
          .from("actions")
          .update({
            status: "sent",
            verification_info: {
              dispatch: {
                channel: "webform",
                at: new Date().toISOString(),
                submitted: true,
              },
            },
            next_attempt_at: null,
            retry_count: 0,
          })
          .eq("id", job.action_id);

        succeeded++;
      } catch (e: any) {
        await db
          .from("webform_jobs")
          .update({
            status: "failed",
            result: { error: `artifact capture failure: ${e?.message || e}` },
          })
          .eq("id", job.id);
        failed++;
      }
    } else {
      await db
        .from("webform_jobs")
        .update({
          status: "failed",
          result: { error: res.error },
        })
        .eq("id", job.id);

      // Backoff the action for retry by dispatcher later
      await db
        .from("actions")
        .update({
          status: "escalate_pending",
          verification_info: {
            dispatch_error: {
              at: new Date().toISOString(),
              code: "WEBFORM_SUBMIT_FAILED",
              message: res.error,
            },
          },
          next_attempt_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq("id", job.action_id);

      failed++;
    }
  }

  return { picked: jobs.length, succeeded, failed };
}
