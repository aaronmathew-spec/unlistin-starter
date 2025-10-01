/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { getPaymentProvider } from "@/lib/payments";

export async function POST(req: Request) {
  const provider = getPaymentProvider();

  // Webhooks must read raw body; in Next 14 route handlers req.text() is fine
  const rawBody = await req.text();
  const sig =
    req.headers.get("stripe-signature") ||
    req.headers.get("x-razorpay-signature") ||
    null;

  const verified = await provider.verifyWebhook(sig, rawBody);

  if (!verified.ok) {
    return new Response("bad signature", { status: 400 });
  }

  // TODO: upsert subscription state by user, mark invoices, etc.
  // verified.eventType & verified.data carry the payload

  return new Response("ok");
}
