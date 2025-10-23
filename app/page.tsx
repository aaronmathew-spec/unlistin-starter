// app/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

export default function LandingPage() {
  const stats = useMemo(
    () => [
      { label: "Controllers Covered", value: "250+" },
      { label: "Avg. SLA Compliance", value: "99.1%" },
      { label: "Proof Bundles Issued", value: "10k+" },
    ],
    []
  );

  return (
    <main className="relative min-h-screen">
      {/* Royal gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_-10%,rgba(139,92,246,.10),rgba(255,255,255,0))]" />
        <div
          className="absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full blur-3xl opacity-25"
          style={{ background: "linear-gradient(90deg,#8B5CF6,#60A5FA,#34D399)" }}
        />
      </div>

      {/* Top bar (marketing) */}
      <header className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full border border-[var(--card-border)] bg-[var(--card)]" />
          <span className="text-sm font-semibold tracking-tight">Unlistin</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost px-3 py-1.5 rounded-full text-sm">Login</Link>
          <Link href="/dashboard" className="btn px-4 py-2 text-sm">Open Console</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-8 pb-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-3 py-1 text-xs text-[color:var(--muted)]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Verifiable privacy service • Tamper-evident proofs
            </div>

            <h1 className="text-3xl md:text-5xl font-semibold leading-tight tracking-tight">
              Remove your personal data with{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                precision
              </span>{" "}
              and keep the evidence.
            </h1>

            <p className="text-base md:text-lg text-[color:var(--muted)]">
              Unlistin acts as your privacy fiduciary—submitting lawful requests, following up
              on SLAs, and maintaining a signed Proof-of-Action Ledger for audits.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="btn px-5 py-2 text-sm"
              >
                Get Started
              </Link>
              <Link
                href="/dashboard"
                className="btn-outline px-5 py-2 rounded-full text-sm hover:bg-[var(--accent)]"
              >
                View Dashboard
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center"
                >
                  <div className="text-2xl font-semibold">{s.value}</div>
                  <div className="text-xs text-[color:var(--muted)]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Luxe card – “what happens behind the scenes” */}
          <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
            <div className="text-sm font-medium">How it works</div>
            <ol className="mt-3 space-y-3 text-sm text-[color:var(--muted)]">
              <li className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--accent)] p-3">
                1. You select controllers and provide only what’s needed (PII minimised).
              </li>
              <li className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--accent)] p-3">
                2. We deliver compliant requests and follow up based on jurisdictional SLAs.
              </li>
              <li className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--accent)] p-3">
                3. Every action is recorded in the Proof-of-Action Ledger and exportable as a signed bundle.
              </li>
            </ol>

            <div className="mt-5 grid gap-2 text-[11px] text-[color:var(--muted)]">
              <div>• RLS & short-lived evidence URLs</div>
              <div>• Signed manifests (KMS/HSM) & Merkle roots</div>
              <div>• Multilingual templates, rate-limited controllers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal feature stripes */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <Tile
            title="Coverage Map"
            body="A living directory of controllers, forms & quirks—kept current and jurisdiction-aware."
          />
          <Tile
            title="Evidence Locker"
            body="Downloadable ZIP bundles with signed manifests for internal audit or regulators."
          />
          <Tile
            title="SLA Follow-ups"
            body="Escalations & reminders operate quietly in the background until closure."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--card-border)]/60">
        <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-[color:var(--muted)] flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Unlistin</div>
          <nav className="flex items-center gap-4">
            <Link href="/policy/privacy" className="hover:underline">Privacy</Link>
            <Link href="/policy/terms" className="hover:underline">Terms</Link>
            <Link href="/help" className="hover:underline">Help</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function Tile({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{body}</p>
    </div>
  );
}
