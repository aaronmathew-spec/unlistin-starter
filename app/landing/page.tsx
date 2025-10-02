// app/landing/page.tsx
"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Glow backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full blur-3xl neon-pulse" />
      </div>

      <section className="mx-auto max-w-5xl px-4 py-14 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          UnlistIN — India-first, AI-assisted{" "}
          <span className="inline-block rounded-lg px-2 py-1" style={{ boxShadow: "0 0 0 2px var(--neon) inset" }}>
            personal data removal
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Quick Scan never stores PII. Deep Scan is encrypted at rest in our Evidence Locker.
          “Secure Reveal” decrypts server-side with short TTL and full audit.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/scan/quick" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Run Quick Scan
          </Link>
          <Link href="/scan/deep" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Try Deep Scan (first scan free)
          </Link>
          <Link href="/ai" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            AI Concierge
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Feature
            title="Blast-Radius Panel"
            body="Chips for services you likely use + one-tap mitigations."
          />
          <Feature
            title="AI Story Card"
            body="Weekly newsletter recap: exposure delta, biggest wins, next best step."
          />
          <Feature
            title="True Dark Mode"
            body="Tuned contrast with subtle neon accents; no inverted hacks."
          />
        </div>
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 text-left shadow-sm">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
