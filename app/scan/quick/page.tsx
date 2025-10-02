// app/scan/quick/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type ScanInput = {
  fullName?: string;
  email?: string;
  city?: string;
};

type ScanHit = {
  broker: string;
  category: string;
  url: string;
  confidence: number; // 0..1
  matchedFields: string[];
  evidence: string[];
};

type ScanResponse =
  | { ok: true; results: ScanHit[]; tookMs: number }
  | { ok: false; error: string; retryAfter?: number };

export default function QuickScanPage() {
  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [took, setTook] = useState<number | null>(null);
  const [results, setResults] = useState<ScanHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canScan = !!(fullName.trim() || email.trim() || city.trim());

  async function runScan() {
    if (!canScan || loading) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setTook(null);

    try {
      const payload: ScanInput = {};
      if (fullName.trim()) payload.fullName = fullName.trim();
      if (email.trim()) payload.email = email.trim();
      if (city.trim()) payload.city = city.trim();

      const res = await fetch("/api/scan/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ScanResponse;

      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg = (json as any)?.error || `HTTP ${res.status}`;
        setError(msg || "Scan failed. Please try again.");
      } else {
        setResults(json.results);
        setTook(json.tookMs);
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-zinc-950 text-zinc-50">
      {/* Decorative background glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[720px] rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-20%] top-[-10%] h-[520px] w-[720px] rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-1/4 h-[420px] w-[620px] rounded-full bg-violet-500/20 blur-3xl" />

      {/* Page container */}
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Top breadcrumb / brand hint (kept minimal, doesn't touch your layout) */}
        <div className="mb-3 text-xs text-zinc-400">
          <Link href="/" className="hover:text-zinc-200">
            UnlistIN
          </Link>{" "}
          / <span className="text-zinc-300">Quick Scan</span>
        </div>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
          {/* Hero copy */}
          <div className="relative">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Quick Scan
            </h1>
            <p className="mt-4 text-zinc-300">
              See where your personal info might appear online —{" "}
              <span className="font-medium text-white">without creating an account</span>. We
              only use the inputs below for this scan and{" "}
              <span className="font-medium text-white">do not store</span> them. Results are
              redacted previews with allowlisted links.
            </p>

            {/* Trust/assurance pills */}
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              {["No persistent PII", "CSP & RLS enforced", "Strict domain allowlist"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-zinc-300 backdrop-blur"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Input card */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-tr from-sky-400/30 via-fuchsia-500/20 to-purple-500/30 blur-xl" />
            <div className="relative rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <div className="grid grid-cols-1 gap-3">
                <LabeledInput
                  label="Full name (recommended)"
                  placeholder="e.g., Priya Sharma"
                  value={fullName}
                  onChange={setFullName}
                />
                <LabeledInput
                  label="Email (optional)"
                  placeholder="e.g., priya@email.com"
                  value={email}
                  onChange={setEmail}
                  type="email"
                />
                <LabeledInput
                  label="City / State (optional)"
                  placeholder="e.g., Mumbai, MH"
                  value={city}
                  onChange={setCity}
                />
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  onClick={runScan}
                  disabled={!canScan || loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-400 px-4 py-3 text-sm font-medium text-white shadow-[0_0_0_3px_rgba(255,255,255,0.08),0_20px_40px_-12px_rgba(99,102,241,.55)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Scanning…" : "Run Quick Scan"}
                </button>

                <Link
                  href="/ai"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-zinc-200 transition hover:bg-white/10 sm:w-auto"
                >
                  Ask the AI assistant
                </Link>
              </div>

              <p className="mt-3 text-center text-xs text-zinc-400">
                Tip: Provide at least one field. Name usually yields the most results.
              </p>
            </div>
          </div>
        </div>

        {/* Results / feedback */}
        <section className="mt-10 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? <ScanSkeleton /> : null}

          {!loading && took != null ? (
            <div className="text-xs text-zinc-400">Completed in {(took / 1000).toFixed(2)}s</div>
          ) : null}

          {!loading && results && results.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-200">
              We didn’t detect likely matches from our initial sources. You can{" "}
              <Link href="/scan/pro" className="underline underline-offset-2">
                run a deeper scan
              </Link>{" "}
              after sign-in (still privacy-respecting), or{" "}
              <Link href="/requests/new" className="underline underline-offset-2">
                start a removal request
              </Link>{" "}
              if you already know a data broker listing your info.
            </div>
          ) : null}

          {!loading && results && results.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-300">Matches</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {results.map((hit, idx) => (
                  <ResultCard key={idx} hit={hit} />
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <span>Want automated takedowns, tracking &amp; proof? Create an account.</span>
                  <Link
                    href="/login"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 transition hover:bg-white/10"
                  >
                    Continue &amp; Save Scan
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Expectation tiles (keep under the form to avoid cluttering hero) */}
        <section className="mt-12">
          <h2 className="text-sm font-medium text-zinc-300">What you’ll see</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PreviewCard name="Justdial" tag="Possible match" />
            <PreviewCard name="Sulekha" tag="Possible match" />
            <PreviewCard name="IndiaMART" tag="Possible match" />
          </div>
        </section>

        <footer className="mt-14 pb-10 text-xs text-zinc-500">
          © {new Date().getFullYear()} UnlistIN • Privacy-first. Made for India.
        </footer>
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */

function LabeledInput({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-400">{label}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-400 outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/30"
      />
    </label>
  );
}

function ScanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5"
          aria-hidden
        />
      ))}
    </div>
  );
}

function ResultCard({ hit }: { hit: ScanHit }) {
  const pct = Math.round(hit.confidence * 100);
  const band =
    pct >= 80 ? "from-emerald-400 to-emerald-500" : pct >= 50 ? "from-amber-400 to-amber-500" : "from-zinc-400 to-zinc-500";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-400">{hit.category}</div>
          <a
            href={hit.url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block text-base font-medium text-white underline-offset-2 hover:underline"
          >
            {hit.broker}
          </a>
          <div className="mt-1 text-xs text-zinc-400">
            Matched: {hit.matchedFields.length ? hit.matchedFields.join(", ") : "—"}
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200">
          {pct}% confidence
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${band}`}
          style={{ width: `${Math.max(5, pct)}%` }}
          aria-hidden
        />
      </div>

      {hit.evidence?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-200">
          {hit.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/login"
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-400 px-3 py-1.5 text-xs font-medium text-white"
        >
          Start automated removal
        </Link>
        <Link
          href="/requests/new"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10"
        >
          Create manual request
        </Link>
      </div>
    </div>
  );
}

function PreviewCard({ name, tag }: { name: string; tag: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-sm backdrop-blur">
      <div className="text-xs text-fuchsia-300/90">{tag}</div>
      <div className="mt-1 text-base font-medium text-white">{name}</div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-400" />
      </div>
      <div className="mt-3 flex gap-2">
        <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10">
          Preview
        </button>
        <Link
          href="/login"
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-400 px-3 py-1.5 text-xs font-medium text-white"
        >
          Start removal
        </Link>
      </div>
    </div>
  );
}
