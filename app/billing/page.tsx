// app/billing/page.tsx
"use client";

import { useState } from "react";

type Plan = {
  name: string;
  price: string;
  period: string;
  stripePriceId?: string;
  features: string[];
  cta: string;
};

const plans: Plan[] = [
  {
    name: "Starter",
    price: "₹0",
    period: "/mo",
    features: [
      "1 quick scan/day",
      "1 manual removal draft",
      "Email support"
    ],
    cta: "Current Plan"
  },
  {
    name: "Pro",
    price: "₹499",
    period: "/mo",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ID,
    features: [
      "Unlimited quick scans",
      "Deep Checks (priority)",
      "5 automated removals/mo",
      "Concierge chat"
    ],
    cta: "Upgrade to Pro"
  },
  {
    name: "Business",
    price: "₹1,999",
    period: "/mo",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_ID,
    features: [
      "Unlimited scans",
      "Unlimited automated removals",
      "Family/Team seats (5)",
      "Priority support"
    ],
    cta: "Upgrade to Business"
  }
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const checkout = async (priceId?: string) => {
    if (!priceId) return;
    setLoading(priceId);
    try {
      const res = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId })
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
      else alert(data?.error ?? "Could not start checkout.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-2 text-sm text-gray-600">
        India-first pricing. Stripe primary; Razorpay coming next (feature flag).
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {plans.map(p => (
          <div key={p.name} className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="text-lg font-medium">{p.name}</div>
            <div className="mt-3 text-3xl font-semibold">
              {p.price} <span className="text-base font-normal text-gray-500">{p.period}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {p.features.map(f => <li key={f}>• {f}</li>)}
            </ul>
            <button
              disabled={!p.stripePriceId || !!loading}
              onClick={() => checkout(p.stripePriceId)}
              className="mt-6 w-full rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {p.stripePriceId ? (loading === p.stripePriceId ? "Redirecting…" : p.cta) : p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
