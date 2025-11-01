// app/billing/page.tsx
"use client";

import { useMemo, useState } from "react";

/** We only read NEXT_PUBLIC_* in the client. */
const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ID || "";
const PRICE_BUSINESS = process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_ID || "";

type Plan = {
  name: string;
  price: string;
  period: string;
  stripePriceId?: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const plans: Plan[] = useMemo(
    () => [
      {
        name: "Starter",
        price: "₹0",
        period: "/mo",
        features: ["1 quick scan/day", "1 manual removal draft", "Email support"],
        cta: "Current Plan",
      },
      {
        name: "Pro",
        price: "₹499",
        period: "/mo",
        stripePriceId: PRICE_PRO || undefined,
        features: [
          "Unlimited quick scans",
          "Deep Checks (priority)",
          "5 automated removals/mo",
          "Concierge chat",
        ],
        cta: "Upgrade to Pro",
        highlight: true,
      },
      {
        name: "Business",
        price: "₹1,999",
        period: "/mo",
        stripePriceId: PRICE_BUSINESS || undefined,
        features: [
          "Unlimited scans",
          "Unlimited automated removals",
          "Family/Team seats (5)",
          "Priority support",
        ],
        cta: PRICE_BUSINESS ? "Upgrade to Business" : "Contact Sales",
      },
    ],
    []
  );

  async function checkout(priceId?: string) {
    if (!priceId) {
      // No price configured in this env — fall back to mailto
      window.location.href = "mailto:sales@unlistin.app?subject=Billing%20Inquiry";
      return;
    }
    setLoading(priceId);
    try {
      const res = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // ignore parse errors; show generic message below
      }
      if (res.ok && json?.url) {
        window.location.href = json.url;
        return;
      }
      alert(json?.error || `Could not start checkout (HTTP ${res.status}).`);
    } catch (e: any) {
      alert(e?.message || "Could not start checkout.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Plans & Billing</h1>
      <p className="mt-2 text-sm text-gray-600">
        India-first pricing. Stripe primary; Razorpay coming next (feature flag).
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border border-gray-200 p-6 shadow-sm ${
              p.highlight ? "ring-1 ring-indigo-200" : ""
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-medium">{p.name}</div>
              <div className="text-3xl font-semibold">
                {p.price} <span className="text-base font-normal text-gray-500">{p.period}</span>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => checkout(p.stripePriceId)}
              disabled={!!loading}
              className="mt-6 w-full rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {p.stripePriceId
                ? loading === p.stripePriceId
                  ? "Redirecting…"
                  : p.cta
                : p.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        Prices are indicative; taxes may apply. Regional billing (India-first) with global rollout to
        follow. Your data stays encrypted at rest; evidence bundles are signed and tamper-evident.
      </div>
    </div>
  );
}
