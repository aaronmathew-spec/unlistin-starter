// app/page.tsx
"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen text-[var(--fg)]">
      {/* Royal gradient canopy */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_-20%,rgba(139,92,246,.18),rgba(0,0,0,0))]" />
        <div
          className="absolute top-[-280px] left-1/2 h-[900px] w-[1200px] -translate-x-1/2 blur-3xl opacity-25"
          style={{ background: "linear-gradient(90deg,#8B5CF6,#6366F1,#34D399)" }}
        />
      </div>

      {/* Top bar */}
      <header className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full border border-[var(--card-border)] bg-[var(--card)] shadow" />
          <span className="text-sm font-semibold tracking-tight">Unlistin</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost px-3 py-1.5 rounded-full text-sm">
            Login
          </Link>
          <Link href="/dashboard" className="btn px-4 py-2 text-sm">
            Open Console
          </Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-6 md:pt-10 md:pb-12 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold leading-tight tracking-tight">
          Remove your personal data with{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
            precision
          </span>{" "}
          — and keep the evidence.
        </h1>
        <p className="mt-4 text-[15px] md:text-lg text-[color:var(--muted)]">
          A managed privacy service that delivers lawful requests, follows up to SLA,
          and maintains a signed Proof-of-Action Ledger for audits.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="btn px-5 py-2 text-sm">
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="btn-outline px-5 py-2 rounded-full text-sm hover:bg-[var(--accent)]"
          >
            View Dashboard
          </Link>
        </div>

        {/* Stats — centered and compact on small, spacious on large */}
        <div className="mt-8 grid grid-cols-3 gap-3 md:gap-6">
          <Stat label="Controllers Covered" value="250+" />
          <Stat label="Avg. SLA Compliance" value="99.1%" />
          <Stat label="Proof Bundles Issued" value="10k+" />
        </div>
      </section>

      {/* Glass card: How it works */}
      <section className="mx-auto max-w-6xl px-6 pb-10 md:pb-16">
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card)]/90 backdrop-blur-md p-6 md:p-8 shadow-[var(--shadow)]">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium tracking-wide text-[color:var(--muted)]">
                How it works
              </div>
              <ol className="mt-3 space-y-3 text-[15px]">
                <li className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--accent)] p-3">
                  1) You select controllers; we request only what’s necessary (PII minimised).
                </li>
                <li className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--accent)] p-3">
                  2) We deliver compliant requests and follow up based on jurisdictional SLAs.
                </li>
                <li className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--accent)] p-3">
                  3) Every action is recorded in the Proof-of-Action Ledger and exportable as a signed bundle.
                </li>
              </ol>
            </div>

            <div className="grid content-start gap-3 text-[13px] text-[color:var(--muted)]">
              <BadgeLine>RLS & short-lived evidence URLs</BadgeLine>
              <BadgeLine>Signed manifests (KMS/HSM) & Merkle roots</BadgeLine>
              <BadgeLine>Jurisdiction-aware templates; rate-limited controllers</BadgeLine>
            </div>
          </div>
        </div>
      </section>

      {/* Feature tiles */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
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
            <Link href="/policy/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/policy/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/help" className="hover:underline">
              Help
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/* ---------- Small presentational helpers ---------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--muted)]">{label}</div>
    </div>
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

function BadgeLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--card-border)] px-3 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
      {children}
    </div>
  );
}
