// app/ops/system/actions.ts
"use server";

import "server-only";

type CallResult =
  | { ok: true; status: number; body?: any }
  | { ok: false; status: number; error: string };

async function securedPost(path: string, payload?: any): Promise<CallResult> {
  const secret = process.env.SECURE_CRON_SECRET || "";
  const base =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${String(process.env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//,"")}`
        : "http://localhost:3000";

  if (!secret) {
    return { ok: false, status: 403, error: "SECURE_CRON_SECRET is not set" };
  }

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secure-cron": secret,
      },
      body: payload ? JSON.stringify(payload) : undefined,
      // Ensure the request always hits the network
      cache: "no-store",
    });

    const text = await res.text();
    let body: any = undefined;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      return { ok: false, status: res.status, error: typeof body === "string" ? body : (body?.error ?? "error") };
    }
    return { ok: true, status: res.status, body };
  } catch (e: any) {
    return { ok: false, status: 500, error: e?.message || "fetch_failed" };
  }
}

export async function actionTestEmail(to?: string) {
  return securedPost("/api/ops/email/test-html", to ? { to } : undefined);
}

export async function actionSlaAlertNow() {
  return securedPost("/api/ops/sla/alert");
}

export async function actionVerifyAlertNow() {
  return securedPost("/api/ops/verify/alert");
}

export async function actionWorkerPulse() {
  return securedPost("/api/ops/webform/worker");
}

export async function actionVerifyRecheck() {
  return securedPost("/api/ops/verify/recheck");
}
