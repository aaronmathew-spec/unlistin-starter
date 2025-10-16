// app/api/webhooks/resend/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { recordResendDelivery, type ResendWebhook } from "@/lib/dispatch/delivery";

// Important: Use the raw body exactly as received
async function rawText(req: Request): Promise<string> {
  // Next's Request exposes .text() which preserves raw payload
  return await req.text();
}

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";
  if (!secret) return bad(500, "missing_resend_webhook_secret");

  // Extract Svix headers (Resend uses Svix under the hood)
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return bad(400, "missing_signature_headers");
  }

  const payload = await rawText(req);
  let evt: ResendWebhook;

  try {
    const wh = new Webhook(secret);
    // verify throws if signature/body mismatch
    const verified = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as any;

    evt = verified as ResendWebhook;
  } catch (e: any) {
    return bad(400, `signature_verification_failed: ${e?.message || "invalid"}`);
  }

  // Only process email.* events we care about
  if (!evt?.type?.startsWith("email.")) {
    return NextResponse.json({ ok: true, ignored: evt?.type ?? "unknown" });
  }

  // Persist a normalized audit row tied to provider_id (email_id)
  await recordResendDelivery(evt);

  return NextResponse.json({ ok: true });
}
