// app/scan/quick/page.tsx
"use client";

export const dynamic = "force-dynamic"; // ensure fresh render (avoid stale static page on prod)

import { useMemo, useState } from "react";
import Link from "next/link";

type ScanInput = { fullName?: string; email?: string; city?: string };
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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [took, setTook] = useState<number | null>(null);
  const [results, setResults] = useState<ScanHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canScan = useMemo(
    () => Boolean(fullName.trim() || email.trim() || city.trim()),
    [fullName, email, city]
  );

  async function runScan() {
    if (!canScan || loading) return;
    setLoading(true);
    setRan(true);
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
        const msg =
          (!res.ok && (json as any)?.error) ||
          (json as any)?.error ||
          `HTTP ${res.status}`;
        setError(msg || "Scan failed. Please try again.");
      } else {
        setResults(json.results ?? []);
        setTook(json.tookMs ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      {/* Background: CSS-only (CSP-safe) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0B1020]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_-20%,rgba(99,102,241,0.25),transparent)]" />
        <div className="absolute left-1/2 top-[-120px] h-[900px] w-[1300px] -translate-x-1/2 rounded-[100%] opacity-30 blur-3xl bg-[conic-gradient(at_50%_50%,#A78BFA_0deg,#60A5FA_120deg,#34D399_240deg,#A78BFA_360deg)]" />
      </div>

      <div className="mx-auto max-w-3xl px-5 py-12 text-white">
        <div className="mb-2 text-xs/5 text-violet-300/70">UnlistIN</div>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Quick Scan</h1>

        <p className="mt-5 max-w-2xl text-sm md:text-base text-white/70">
          See where your personal info might appear online —{" "}
          <span className="font-semibold text-white">without creating an account</span>. We only use the inputs
          below for this scan and <span className="font-semibold text-white">do not store</span> them. Results are
          redacted previews with allowlisted links.
        </p>

        {/* Form */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 shadow-[0_10px_40px_rgba(0,0,0,.35)] backdrop-blur">
          <div className="grid grid-cols-1 gap-4">
            <Field
              label="Full name (recommended)"
              placeholder="e.g., Priya Sharma"
              value={fullName}
              onChange={setFullName}
            />
            <Field
              label="Email (optional)"
              placeholder="e.g., priya***@gmail.com"
              value={email}
              onChange={setEmail}
            />
            <Field
              label="City / State (optional)"
              placeholder="e.g., Mumbai, MH"
              value={city}
              onChange={setCity}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={runScan}
              aria-disabled={!canScan || loading}
              className={[
                "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition",
                "text-white",
                canScan
                  ? "bg-[linear-gradient(135deg,#F472B6_0%,#A78BFA_50%,#60A5FA_100%)] hover:opacity-95"
                  : "bg-white/10 cursor-not-allowed opacity-50",
                loading ? "opacity-70" : "",
              ].join(" ")}
            >
              {loading ? Spinner() : "Run Quick Scan"}
            </button>

            <div className="text-xs text-white/60">
              Tip: Provide at least one field. Name usually yields the most results.
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              {error}
            </div>
          ) : null}

          {typeof took === "number" && (
            <div className="mt-3 text-[11px] text-white/50">
              Scan completed in {(took / 1000).toFixed(2)}s
            </div>
          )}
        </section>

        {/* Results */}
        <section className="mt-8 space-y-4">
          {!loading && ran && results && results.length === 0 && <EmptyState />}

          {loading && <ResultsSkeleton />}

          {!loading && results && results.length > 0 && (
            <div className="grid gap-4">
              {results.map((hit, i) => (
                <ResultCard key={i} hit={hit} />
              ))}
            </div>
          )}
        </section>

        {/* Trust row */}
        <section className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-white/55">
          <span>• No persistent PII</span>
          <span>• CSP & RLS enforced</span>
          <span>• Strict domain allowlist</span>
          <Link href="/ai" className="underline decoration-white/30 underline-offset-4 hover:decoration-white">
            Ask the AI assistant
          </Link>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="group grid gap-1.5">
      <span className="text-xs text-white/70">{label}</span>
      <div className="rounded-xl border border-white/10 bg-white/5 ring-0 transition group-focus-within:border-white/20 group-hover:border-white/20">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-transparent px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>
    </label>
  );
}

function ResultCard({ hit }: { hit: ScanHit }) {
  const pct = Math.max(1, Math.min(97, Math.round(hit.confidence * 100)));
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-white/60">{hit.category}</div>
          <a
            href={hit.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-base font-medium text-white underline decoration-white/20 underline-offset-4 hover:decoration-white"
            title={hit.broker}
          >
            {hit.broker}
          </a>
          {hit.matchedFields?.length ? (
            <div className="mt-1 text-[11px] text-white/60">Matched: {hit.matchedFields.join(", ")}</div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/80">
          Confidence {pct}%
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
        <div
          className="h-1.5 rounded-full bg-[linear-gradient(90deg,#A78BFA_0%,#60A5FA_50%,#34D399_100%)]"
          style={{ width: `${pct}%` }}
        />
      </div>

      {hit.evidence?.length ? (
        <ul className="mt-3 space-y-1.5 text-xs text-white/80">
          {hit.evidence.map((e, i) => (
            <li key={i} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {e}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/requests/new"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
        >
          Create manual request
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-white/0 bg-white/90 px-3 py-1.5 text-sm text-black hover:bg-white"
        >
          Start automated removal
        </Link>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
      No obvious matches from initial sources. You can{" "}
      <Link href="/scan/pro" className="underline decoration-white/30 underline-offset-4 hover:decoration-white">
        run a deeper scan
      </Link>{" "}
      after sign-in, or{" "}
      <Link href="/requests/new" className="underline decoration-white/30 underline-offset-4 hover:decoration-white">
        start a removal request
      </Link>
      .
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-3 w-64 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-1.5 w-full animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-8 w-40 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" role="progressbar" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
