// app/(marketing)/pricing/page.tsx
"use client";

import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Quick Scan is always free and never stores PII. Your first Deep Scan is free with
          consent; artifacts are encrypted at rest. Automation & re-checks are paid.
        </p>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Plan
          name="Free"
          price="₹0"
          blurb="Best for quick checks."
          features={[
            "Quick Scan (no PII persistence)",
            "Allowlisted previews only",
            "Verify locally (on-device)",
          ]}
          cta={{ href: "/scan/quick", label: "Run Quick Scan" }}
        />
        <Plan
          name="Starter"
          price="₹0 (first Deep Scan)"
          blurb="One-time full sweep."
          features={[
            "Deep Scan v1 (India-wide)",
            "Encrypted Evidence Locker",
            "Secure Reveal (short TTL + audit)",
          ]}
          highlight
          cta={{ href: "/scan/deep", label: "Start Deep Scan" }}
        />
        <Plan
          name="Pro"
          price="TBD"
          blurb="For ongoing protection."
          features={[
            "Action Queue & follow-ups",
            "AI removal drafts & broker forms",
            "Re-checks + dark-web enrichment",
          ]}
          cta={{ href: "/ai", label: "Talk to AI Concierge" }}
        />
      </section>

      <section className="mt-12 rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Enterprise</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seat-based pricing with SSO and workspaces. Unlimited scans within rate caps,
          redacted exports, and encrypted counsel bundles.
        </p>
        <div className="mt-4">
          <Link href="/ai" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}

function Plan({
  name,
  price,
  blurb,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: { href: string; label: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card p-6 shadow-sm ${
        highlight ? "ring-2 ring-[var(--neon)]" : ""
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-base font-semibold">{name}</div>
        <div className="text-2xl font-semibold">{price}</div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--neon)" }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Link href={cta.href} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          {cta.label}
        </Link>
      </div>
    </div>
  );
}
