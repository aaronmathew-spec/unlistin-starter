// app/api/billing/stripe/checkout/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * POST /api/billing/stripe/checkout
 * Body: { priceId: string, successUrl?: string, cancelUrl?: string }
 * Creates a Stripe Checkout Session using Stripe's REST API (no SDK).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const priceId = (body?.priceId ?? "").toString().trim();
  const origin = new URL(req.url).origin;
  const successUrl =
    (body?.successUrl ?? "").toString().trim() || `${origin}/billing?success=1`;
  const cancelUrl =
    (body?.cancelUrl ?? "").toString().trim() || `${origin}/billing?canceled=1`;

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    // Billing not configured -> friendly 503
    return NextResponse.json(
      { ok: false, error: "Billing not configured." },
      { status: 503 }
    );
  }
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "Missing priceId." },
      { status: 400 }
    );
  }

  // Create Checkout Session via Stripe REST (form-encoded)
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  // line_items[0][price]=...&line_items[0][quantity]=1
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  // allow_promotion_codes=true
  params.set("allow_promotion_codes", "true");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: params.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Surface stripe error message if present
    const errMsg =
      json?.error?.message ||
      json?.error ||
      `Stripe error (${res.status})`;
    return NextResponse.json({ ok: false, error: errMsg }, { status: 400 });
  }

  // Checkout Session URL
  const url = json?.url as string | undefined;
  if (!url) {
    return NextResponse.json(
      { ok: false, error: "Stripe did not return a session URL." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, url });
}
