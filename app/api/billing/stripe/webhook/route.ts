// app/api/billing/stripe/webhook/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

// Webhook handler is a stub that returns 200 to keep builds green.
// Replace with real entitlement writes in your Supabase later.
export async function POST(req: Request) {
  // NOTE: For local dev you can log and inspect the payload.
  // const raw = await req.text();
  return NextResponse.json({ ok: true });
}
