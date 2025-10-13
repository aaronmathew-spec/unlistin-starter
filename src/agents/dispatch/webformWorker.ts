// src/agents/dispatch/webformWorker.ts
import { createClient } from "@supabase/supabase-js";
import { captureAndStoreArtifacts } from "@/agents/verification/capture";
import { sendAlert } from "@/lib/ops/alerts";

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
  scheduled_at?: string | null;
  run_at?: string | null;
  completed_at?: string | null;
  result?: any;
};

type ControllerProfile = {
  field_selectors?: Record<string, string[]>;
  submit_selectors?: string[];
  captcha?: { type?: string | null; sitekey?: string | null; widgetSelector?: string | null };
  throttle_ms?: number;
};

function ms(n: number) {
  return new Promise((r) => setTimeout(r, n));
}

/** Backoff policy with jitter (world-class, RFC-style) */
function nextBackoffMs(attempt: number) {
  const base = Number(process.env.WEBFORM_BASE_BACKOFF_MS ?? 60_000);
  const cap = Number(process.env.WEBFORM_MAX_BACKOFF_MS ?? 1_800_000);
  // exponential: base * 2^(attempt-1), capped, ±20% jitter
  const exp = Math.min(base * Math.pow(2, Math.max(0, attempt - 1)), cap);
  const jitter = exp * (0.8 + Math.random() * 0.4);
  return Math.floor(jitter);
}
function maxAttempts() {
  return Number(process.env.WEBFORM_MAX_ATTEMPTS ?? 6);
}

/** Defaults */
const DEFAULT_FIELDS: Record<string, string[]> = {
  name: ["input[name*=name i]", "input#name", "input[autocomplete='name']"],
  email: ["input[type=email]", "input[name*=email i]", "input#email"],
  phone: ["input[type=tel]", "input[name*=phone i]", "input#phone"],
  message: [
    "textarea[name*=message i]",
    "textarea#message",
    "textarea",
    "input[name*=message i]",
  ],
  request: [
    "textarea[name*=request i]",
    "textarea[name*=dsr i]",
    "textarea[name*=gdpr i]",
  ],
};
const DEFAULT_SUBMITS = [
  "button[type=submit]",
  "input[type=submit]",
  "button:has-text('Submit')",
  "button:has-text('Send')",
  "button:has-text('Request')",
  "button:has-text('Continue')",
];

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
function buildThrottleDelay(hostname: string, profileMs?: number, min = 800, max = 1600) {
  if (profileMs && profileMs > 0) return profileMs;
  const base = min + Math.floor(Math.random() * (max - min));
  const bonus = hostname.includes("support") || hostname.includes("help") ? 200 : 0;
  return base + bonus;
}

async function loadControllerProfile(actionId: string, domain: string): Promise<ControllerProfile> {
  const { data: action } = await db
    .from("actions")
    .select("controller_id")
    .eq("id", actionId)
    .single();
  const controller_id = (action as any)?.controller_id ?? null;

  if (controller_id) {
    const { data } = await db
      .from("controller_profiles")
      .select("field_selectors, submit_selectors, captcha, throttle_ms")
      .eq("controller_id", controller_id)
      .limit(1);
    if (data && data[0]) return data[0] as ControllerProfile;
  }
  const { data: dom } = await db
    .from("controller_profiles")
    .select("field_selectors, submit_selectors, captcha, throttle_ms")
    .eq("domain", domain.toLowerCase())
    .limit(1);
  if (dom && dom[0]) return dom[0] as ControllerProfile;
  return {};
}

async function submitWebform(job: JobRow) {
  const { chromium }: any = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
  });
  const page = await context.newPage();

  const u = new URL(job.url);

  try {
    const profile = await loadControllerProfile(job.action_id, u.hostname);
    const FIELDS: Record<string, string[]> = {
      ...DEFAULT_FIELDS,
      ...(profile.field_selectors || {}),
    };
    const SUBMITS =
      profile.submit_selectors && profile.submit_selectors.length > 0
        ? profile.submit_selectors
        : DEFAULT_SUBMITS;
    const delay = buildThrottleDelay(u.hostname, profile.throttle_ms);

    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await ms(delay);

    const p = job.payload || {};
    await typeBest(page, FIELDS.name ?? [], p.name || p.legalName || p.fullName);
    await ms(delay);
    await typeBest(page, FIELDS.email ?? [], p.email);
    await ms(delay);
    await typeBest(page, FIELDS.phone ?? [], p.phone);
    await ms(delay);

    const message =
      p.message ||
      p.requestText ||
      "I am exercising my right to request deletion of my personal data associated with the information provided.";
    await typeBest(page, FIELDS.message ?? [], message);
    await ms(delay);

    if (profile.captcha?.type) {
      await ms(1000); // hook point for captcha solver
    }

    const clicked = await clickFirst(page, SUBMITS);
    if (!clicked) throw new Error("No obvious submit button found");

    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await ms(delay);

    const html = await page.content();
    const text = (await page.textContent("body")) || "";
    const screenshot = await page.screenshot({ fullPage: true });

    await browser.close();

    return {
      ok: true,
      confirmationText: text.slice(0, 5000),
      html,
      screenshot,
    };
  } catch (e: any) {
    await browser.close();
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Internal: reschedule failed jobs w/ backoff or mark permanently failed */
async function handleFailure(job: JobRow, errorMsg: string) {
  const nextAttempt = (job.attempt || 0) + 1;
  if (nextAttempt < maxAttempts()) {
    const delayMs = nextBackoffMs(nextAttempt);
    const nextTime = new Date(Date.now() + delayMs).toISOString();

    await db
      .from("webform_jobs")
      .update({
        status: "queued",
        attempt: nextAttempt,
        scheduled_at: nextTime,
        result: { error: errorMsg, retried_at: new Date().toISOString(), delay_ms: delayMs },
      })
      .eq("id", job.id);
  } else {
    await db
      .from("webform_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        result: { error: errorMsg, terminal: true },
      })
      .eq("id", job.id);

    await db
      .from("actions")
      .update({
        status: "escalate_pending",
        verification_info: {
          dispatch_error: {
            at: new Date().toISOString(),
            code: "WEBFORM_SUBMIT_FAILED",
            message: errorMsg,
            terminal: true,
          },
        },
        next_attempt_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h
      })
      .eq("id", job.action_id);
  }
}

export async function processNextWebformJobs(limit = 3) {
  // Only pick jobs ready to run
  const { data: jobs, error } = await db
    .from("webform_jobs")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
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
      try {
        const cap = await captureAndStoreArtifacts({
          subjectId: job.subject_id,
          actionId: job.action_id,
          url: job.url,
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
        await handleFailure(job, `artifact capture failure: ${e?.message || e}`);
        failed++;
      }
    } else {
      await handleFailure(job, res.error);
      failed++;
    }
  }

  // After each batch, check for spikes and alert (domain-based)
  await maybeSendFailureSpikeAlert();

  return { picked: jobs.length, succeeded, failed };
}

/** Look back N minutes; if failures exceed threshold, alert with breakdown by domain */
async function maybeSendFailureSpikeAlert() {
  const windowMin = Number(process.env.ALERT_WINDOW_MINUTES ?? 30);
  const threshold = Number(process.env.ALERT_FAILURE_THRESHOLD ?? 5);
  if (!process.env.ALERT_WEBHOOK_URL) return;

  const since = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("webform_jobs")
    .select("url")
    .eq("status", "failed")
    .gte("updated_at", since)
    .limit(1000);

  if (error || !data || data.length === 0) return;

  const byDomain: Record<string, number> = {};
  for (const r of data as Array<{ url: string }>) {
    try {
      const d = new URL(r.url).hostname.toLowerCase();
      byDomain[d] = (byDomain[d] || 0) + 1;
    } catch {}
  }
  const total = Object.values(byDomain).reduce((a, b) => a + b, 0);
  if (total >= threshold) {
    await sendAlert({
      type: "WEBFORM_FAILURE_SPIKE",
      windowMinutes: windowMin,
      totalFailed: total,
      byDomain,
      at: new Date().toISOString(),
    });
  }
}
