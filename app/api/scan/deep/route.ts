// app/api/scan/deep/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { createDeepScanJob, type DeepScanInput } from "@/lib/deepscan-jobs";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

export const runtime = "nodejs"; // Redis lib prefers node runtime

export async function POST(req: Request) {
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const input: DeepScanInput = {
    query: typeof body?.query === "string" ? body.query.slice(0, 256) : undefined,
    name: typeof body?.name === "string" ? body.name.slice(0, 128) : undefined,
    email: typeof body?.email === "string" ? body.email.slice(0, 256) : undefined,
    city: typeof body?.city === "string" ? body.city.slice(0, 128) : undefined,
    consent: !!body?.consent,
    emailVerified: !!body?.emailVerified,
    mask: body?.mask !== false, // default true (mask email)
  };

  if (!input.consent) {
    return json({ error: "Consent required for Deep Scan." }, { status: 400 });
  }

  // Don’t require email, but better matches when present. That’s okay for now.
  const job = await createDeepScanJob(input);
  return json({ jobId: job.id });
}
