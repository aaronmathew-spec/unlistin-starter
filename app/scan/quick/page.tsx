"use client";

import { useState } from "react";
import Link from "next/link";

type ScanInput = { fullName?: string; email?: string; city?: string };
type ScanHit = {
  broker: string; category: string; url: string; confidence: number;
  matchedFields: string[]; evidence: string[];
};
type ScanResponse =
  | { ok: true; results: ScanHit[]; tookMs: number }
  | { ok: false; error: string; retryAfter?: number };

export default function QuickScanPage() {
  // form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  // ui
  const [loading, setLoading] = useState(false);
  const [took, setTook] = useState<number | null>(null);
  const [results, setResults] = useState<ScanHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canScan = !!(fullName.trim() || email.trim() || city.trim());

  async function runScan() {
    if (!canScan || loading) return;
    setLoading(true); setError(null); setResults(null); setTook(null);
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
        setError(("error" in json && json.error) || `HTTP ${res.status}`);
      } else {
        setResults(json.results); setTook(json.tookMs);
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
      {/* Aurora backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-600 opacity-25 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 opacity-25 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl px-6 py-10">
        {/* brand crumb */}
        <div className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:underline">UnlistIN</Link> / Quick Scan
        </div>

        {/* hero card */}
        <section className="rounded-3xl border border-zinc-200 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
            Quick Scan
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
            See where your personal info might appear online — <b>without creating an account</b>.
            We only use the inputs below for this scan and <b>do not store</b> them.
          </p>

          {/* form */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <LabeledInput
              label="Full name (recommended)" placeholder="e.g., Priya Sharma"
              value={fullName} onChange={setFullName}
            />
            <LabeledInput
              label="Email (optional)" placeholder="e.g., priya***@gmail.com"
              value={email} onChange={setEmail}
            />
            <LabeledInput
              label="City / State (optional)" placeholder="e.g., Mumbai, MH"
              value={city} onChange={setCity}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={runScan}
              disabled={!canScan || loading}
              className="rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition
                         hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Scanning…" : "Run Quick Scan"}
            </button>
            <Link href="/ai" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Ask the AI assistant
            </Link>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Provide at least one field. Name usually yields the most results.
            </div>
          </div>
        </section>

        {/* feedback + results */}
        <section className="mt-6 space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
              Error: {error}
            </div>
          )}

          {loading && <ScanSkeleton />}

          {!loading && took != null && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Completed in {(took / 1000).toFixed(2)}s</div>
          )}

          {!loading && results && results.length === 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 text-sm text-zinc-700 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              We didn’t detect likely matches from our initial sources. You can{" "}
              <Link href="/scan/pro" className="underline">run a deeper scan</Link> after sign-in,
              or <Link href="/requests/new" className="underline">start a removal request</Link> if you
              already know a broker listing your info.
            </div>
          )}

          {!loading && results && results.length > 0 && (
            <div className="space-y-3">
              {results.map((hit, i) => <ResultCard key={i} hit={hit} />)}
              <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="text-zinc-700 dark:text-zinc-300">
                    Want automated takedowns & tracking? Create an account.
                  </div>
                  <Link href="/login" className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    Continue & Save Scan
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LabeledInput({
  label, placeholder, value, onChange,
}: { label: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800
                   outline-none transition focus:ring-2 focus:ring-violet-500/40
                   dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </label>
  );
}

function ScanSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-200 bg-white/70 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mb-2 h-4 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mb-2 h-3 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/70" />
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/70" />
          <div className="h-8 w-36 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

function ResultCard({ hit }: { hit: ScanHit }) {
  const pct = Math.round(hit.confidence * 100);
  const badge =
    pct >= 80 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
    : pct >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-500">{hit.category}</div>
          <a href={hit.url} target="_blank" rel="noreferrer" className="text-base font-medium underline decoration-1 underline-offset-2">
            {hit.broker}
          </a>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Matched: {hit.matchedFields.join(", ")}
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge}`}>Confidence {pct}%</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-200" style={{ width: `${Math.max(5, pct)}%` }} />
      </div>
      {hit.evidence?.length > 0 && (
        <ul className="mt-3 ml-5 list-disc space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
          {hit.evidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/login" className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          Start automated removal
        </Link>
        <Link href="/requests/new" className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          Create manual request
        </Link>
      </div>
    </div>
  );
}
