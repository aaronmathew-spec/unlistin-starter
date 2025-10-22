// src/lib/webform/queue.ts

type EnqueueArgs = {
  subjectId: string;
  url: string;
  meta?: Record<string, any>;
};

function baseUrl(): string | null {
  // Prefer explicit base; else try Vercel URL; else null (local/dev)
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  return null;
}

/**
 * Enqueue a webform job.
 * Default behavior: call the worker endpoint immediately (fire-and-forget).
 * This keeps parity with your /ops/system manual triggers and Cron jobs.
 */
export async function enqueueWebformJob(args: EnqueueArgs): Promise<void> {
  const { subjectId, url, meta } = args;
  const base = baseUrl();
  const secret = process.env.SECURE_CRON_SECRET;

  if (!base || !secret) {
    // Safe no-op fallback to avoid breaking local/dev
    console.warn(
      "[enqueueWebformJob] Missing BASE_URL/SECURE_CRON_SECRET; logging only.",
      { subjectId, url, meta }
    );
    return;
  }

  const endpoint = `${base}/api/ops/webform/worker`;
  const payload = {
    job: {
      subjectId,
      url,
      meta: meta ?? {},
      // You can add more fields here if your worker expects them
    },
  };

  try {
    // POST to your worker endpoint with the secure header (same as Cron)
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secure-cron": secret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[enqueueWebformJob] worker call failed", res.status, txt);
    }
  } catch (e) {
    console.error("[enqueueWebformJob] worker call error", e);
  }
}
