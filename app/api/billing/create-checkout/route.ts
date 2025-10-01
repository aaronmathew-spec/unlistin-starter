/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPaymentProvider } from "@/lib/payments";
import type { CheckoutRequest, Currency, PlanId } from "@/lib/payments/types";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

type Database = any;

function supa() {
  const jar = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { get: (k) => jar.get(k)?.value },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const plan = (body?.plan as PlanId) || "pro";
    const currency = (body?.currency as Currency) || "inr";

    const successUrl = body?.successUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`;
    const cancelUrl = body?.cancelUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`;

    const db = supa();
    const { data: { user } = { user: null } } = await db.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, { status: 401 });

    const provider = getPaymentProvider();
    const reqPayload: CheckoutRequest = {
      plan,
      currency,
      userId: user.id,
      email: user.email,
      successUrl,
      cancelUrl,
    };

    const { url } = await provider.createCheckout(reqPayload);
    return json({ url, provider: provider.name });
  } catch (e: any) {
    return json({ error: e?.message ?? "Checkout failed" }, { status: 500 });
  }
}
