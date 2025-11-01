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

type QuickScanResponse =
  | { ok: true; results: ScanHit[]; tookMs: number }
  | { ok: false; error: string };

type DarkPreviewHit = {
  source: string;
  domain: string;
  url: string;
  risk: "high" | "medium" | "low";
  note: string;
};

type TiPreviewResponse =
  | { ok: true; hits: DarkPreviewHit[] }
  | { ok: false; error: string };

export default function QuickScanPage() {
  // form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  // results & status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScanHit[] | null>(null);
  const [took, setTook] = useState<number | null>(null);

  // dark-web preview state
  const [tiLoading, setTiLoading] = useState(false);
  const [tiError, setTiError] = useState<string | null>(null);
  const [tiHits, setTiHits] = useState<DarkPreviewHit[] | null>(null);

  // “Verify locally” modal
  const [verifyOpen, setVerifyOpen] = useState<null | { broker: string; query: string }>(null);

  const canScan = !!(fullName.trim() || email.trim() || city.trim());

  async function runScan() {
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

      const json = (await res.json()) as QuickScanResponse;

      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg = (json as any)?.error || `HTTP ${res.status}`;
        setError(msg || "Scan failed. Please try again.");
      } else {
        const cityToken = city.trim().toLowerCase();
        const ranked = [...json.results].sort((a, b) => {
          const base = b.confidence - a.confidence;
          if (!cityToken) return base;
          const has = (hit: ScanHit) =>
            (hit.evidence || []).some((e) => e.toLowerCase().includes(cityToken)) ? 1 : 0;
          return has(b) - has(a) || base;
        });
        setResults(ranked);
        setTook(json.tookMs);
      }
    } catch (e: any) {
      setError(e?.message || "Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTiPreview() {
    if (!email.trim() && !fullName.trim()) {
      setTiError("Enter an email or username to fetch preview hints.");
      setTiHits(null);
      return;
    }
    setTiLoading(true);
    setTiError(null);
    setTiHits(null);
    try {
      const res = await fetch("/api/ti/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          username: fullName.trim() || undefined,
        }),
      });
      const json = (await res.json()) as TiPreviewResponse;
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg = (json as any)?.error || `HTTP ${res.status}`;
        setTiError(msg || "Couldn’t fetch dark-web hints.");
      } else {
        setTiHits(json.hits);
      }
    } catch (e: any) {
      setTiError(e?.message || "Couldn’t fetch dark-web hints.");
    } finally {
      setTiLoading(false);
    }
  }

  function onVerifyLocally(broker: string) {
    const parts = [fullName.trim(), email.trim(), city.trim()].filter(Boolean).join(" ");
    const q = `${parts} site:${broker}`;
    setVerifyOpen({ broker, query: q });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Quick Scan (no PII persisted)</h1>
        <p className="text-sm text-muted-foreground">
          We only send redacted previews and allowlisted evidence URLs to the browser. Nothing you
          enter here is stored.
        </p>
      </header>

      {/* Form */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LabeledInput
            label="Full name (recommended)"
            placeholder="e.g., Priya Sharma"
            value={fullName}
            onChange={setFullName}
          />
          <LabeledInput
            label="Email (optional)"
            placeholder="e.g., priya***@gmail.com"
            value={email}
            onChange={setEmail}
          />
          <LabeledInput
            label="City / State (optional)"
            placeholder="e.g., Mumbai, MH"
            value={city}
            onChange={setCity}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            onClick={runScan}
            disabled={!canScan || loading}
            aria-disabled={!canScan || loading}
          >
            {loading ? "Scanning…" : "Run Quick Scan"}
          </button>

          <Link href="/scan/deep" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Try Deep Scan (free first scan)
          </Link>

          <button
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            onClick={fetchTiPreview}
            disabled={tiLoading}
            aria-disabled={tiLoading}
            title="Preview-only, allowlisted dark-web indicators"
          >
            {tiLoading ? "Fetching hints…" : "Dark-Web Preview (consumer)"}
          </button>
        </div>
      </section>

      {/* Errors */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Dark-Web Hints */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Dark-Web Hints (Preview-only)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          We show allowlisted, non-sensitive indicators. Full enrichment is done only in Deep Scan
          with consent; data is stored encrypted and UI is redacted by default.
        </p>

        {!tiHits && !tiError ? (
          <div className="mt-3 text-sm text-muted-foreground">No hints fetched yet.</div>
        ) : null}

        {tiError ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {tiError}
          </div>
        ) : null}

        {tiHits?.length ? (
          <ul className="mt-4 grid grid-cols-1 gap-3">
            {tiHits.map((h, i) => (
              <li key={i} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {h.source} <span className="text-xs text-gray-500">({h.domain})</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">{h.note}</div>
                    <div className="mt-2 text-xs">
                      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5">
                        {h.risk === "high" ? "Risk: High" : h.risk === "medium" ? "Risk: Medium" : "Risk: Low"}
                      </span>
                    </div>
                  </div>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
                  >
                    Open source
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Results */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Results</h2>
          <div className="text-xs text-muted-foreground">{took != null ? <>Took {took}ms</> : null}</div>
        </div>

        {!results && loading ? <ScanSkeleton /> : null}
        {!results && !loading ? (
          <div className="mt-3 text-sm text-muted-foreground">
            No results yet. Run a scan to see redacted, allowlisted previews.
          </div>
        ) : null}

        {results?.length ? (
          <div className="mt-3 space-y-3">
            {results.map((hit, i) => (
              <ResultCard key={`${hit.url}-${i}`} hit={hit} onVerify={() => onVerifyLocally(hit.broker)} />
            ))}
          </div>
        ) : null}
      </section>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/ai" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          AI Concierge
        </Link>
        <Link href="/requests/new" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          Create manual request
        </Link>
      </div>

      {/* Verify-locally modal */}
      {verifyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setVerifyOpen(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold">Verify locally</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Copy this query and search in your own browser to verify on the source without sharing PII with us:
            </p>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border bg-gray-50 p-3 text-xs">
              {verifyOpen.query}
            </pre>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => navigator.clipboard.writeText(verifyOpen.query).catch(() => {})}
              >
                Copy
              </button>
              <button
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => setVerifyOpen(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** ---------- local components ---------- */

function LabeledInput({
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
    <label className="block">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <input
        className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ScanSkeleton() {
  return (
    <div className="mt-3 space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border bg-white p-4">
          <div className="mb-2 h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mb-2 h-3 w-64 animate-pulse rounded bg-gray-100" />
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-36 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function ResultCard({ hit, onVerify }: { hit: ScanHit; onVerify: () => void }) {
  const pct = Math.round(hit.confidence * 100);
  const band =
    pct >= 80 ? "bg-emerald-100 text-emerald-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700";

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{hit.broker}</div>
          <div className="mt-0.5 text-xs text-gray-600">{hit.category}</div>
          <div className="mt-1 text-xs text-gray-600">
            Matched: {hit.matchedFields?.join(", ") || "—"}
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${band}`}>Confidence {pct}%</span>
      </div>

      {hit.evidence?.length ? (
        <ul className="mt-3 ml-5 list-disc space-y-1 text-xs text-gray-700">
          {hit.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50" href={hit.url} target="_blank" rel="noreferrer">
          Open allowlisted source
        </a>
        <button
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
          onClick={onVerify}
          title="Verify directly on your device (private search string)"
        >
          Verify locally
        </button>
      </div>
    </div>
  );
}
