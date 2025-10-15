// app/ops/dispatch/actions.ts
"use server";

import { headers } from "next/headers";

/**
 * Server Action that posts to /api/ops/dispatch/send with x-secure-cron header.
 * We construct the absolute URL using the current request headers so this works
 * in local dev and on Vercel (https + correct host).
 */

type SendPayload = {
  controllerKey: "truecaller" | "naukri" | "olx" | "foundit" | "shine" | "timesjobs" | "generic";
  controllerName: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale: "en" | "hi";
};

export async function sendOpsDispatchAction(payload: SendPayload) {
  const secret = process.env.SECURE_CRON_SECRET;
  if (!secret) {
    return { ok: false, error: "SECURE_CRON_SECRET not configured" };
  }

  const h = headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("host") || "localhost:3000";
  const base = `${proto}://${host}`;
  const url = `${base}/api/ops/dispatch/send`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-secure-cron": secret,
    },
    body: JSON.stringify(payload),
    // Tell Next this is a server-side internal call
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({} as any));

  if (!res.ok || json?.ok !== true) {
    return { ok: false, error: json?.error || `HTTP ${res.status}`, hint: json?.hint };
  }
  return { ok: true, channel: json.channel, providerId: json.providerId || null, note: json.note || null };
}
