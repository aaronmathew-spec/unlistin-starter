/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { beat } from "@/lib/ops/heartbeat";
import { isAdmin } from "@/lib/auth";
import { sendQueuedEmails } from "@/lib/mailer";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

export async function POST(req: Request) {
  await beat("outbox.send");

  // Admin-only; treat as a cron hook you call manually or via Vercel Scheduler.
  if (!(await isAdmin())) {
    return json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let limit = 25;
  try {
    const body = await req.json().catch(() => ({}));
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(200, body.limit));
  } catch {
    /* ignore */
  }

  const { ok, sent, errors } = await sendQueuedEmails({ limit });
  return NextResponse.json({ ok, sent, errors });
}
