// app/api/billing/stripe/checkout/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const priceId = (body?.priceId ?? "").toString().trim();
  const successUrl = (body?.successUrl ?? "").toString().trim() || `${new URL(req.url).origin}/billing?success=1`;
  const cancelUrl = (body?.cancelUrl ?? "").toString().trim() || `${new URL(req.url).origin}/billing?canceled=1`;

  // Build-safe: don’t import stripe if no key (avoids build-time crashes)
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    return NextResponse.json(
      { ok: false, error: "Billing not configured." },
      { status: 503 }
    );
  }

  if (!priceId) {
    return NextResponse.json({ ok: false, error: "Missing priceId." }, { status: 400 });
  }

  const { Stripe } = await import("stripe");
  const stripe = new Stripe(sk, { apiVersion: "2024-06-20" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true
  });

  return NextResponse.json({ ok: true, url: session.url });
}
