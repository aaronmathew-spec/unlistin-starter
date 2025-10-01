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
  // Form state (minimal input)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [took, setTook] = useState<number | null>(null);
  const [results, setResults] = useState<ScanHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simple client-side validation: allow empty, but at least one field
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
      const json = (await res.json()) as ScanResponse;

      if (!res.ok || !json.ok) {
        const msg = "error" in json ? json.error : `HTTP ${res.status}`;
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
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header / Hero */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Quick Scan</h1>
        <p className="text-sm text-gray-600">
          See where your personal info might appear online —{" "}
          <strong>without creating an account</strong>. We only use the inputs below for this scan
          and do <strong>not store</strong> them.
        </p>
      </header>

      {/* Form */}
      <section className="rounded-2xl border bg-white p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={runScan}
            disabled={!canScan || loading}
          >
            {loading ? "Scanning…" : "Run Quick Scan"}
          </button>

          <Link href="/ai" className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">
            Ask the AI assistant
          </Link>

          <span className="text-xs text-gray-500">
            Tip: Provide at least one field. Name usually yields the most results.
          </span>
        </div>
      </section>

      {/* Results */}
      <section className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-3 text-sm">
            Error: {error}
          </div>
        ) : null}

        {loading ? <ScanSkeleton /> : null}

        {!loading && took != null ? (
          <div className="text-xs text-gray-500">Completed in {(took / 1000).toFixed(2)}s</div>
        ) : null}

        {!loading && results && results.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            We didn’t detect likely matches from our initial sources. You can{" "}
            <Link href="/scan/pro" className="underline">
              run a deeper scan
            </Link>{" "}
            after sign-in (still privacy-respecting), or{" "}
            <Link href="/requests/new" className="underline">
              start a removal request
            </Link>{" "}
            if you already know a data broker listing your info.
          </div>
        ) : null}

        {!loading && results && results.length > 0 ? (
          <div className="space-y-3">
            {results.map((hit, idx) => (
              <ResultCard key={idx} hit={hit} />
            ))}

            <div className="rounded-xl border bg-white p-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Want automated takedowns, tracking & proof? Create an account.
              </div>
              <Link href="/login" className="px-3 py-1 rounded border hover:bg-gray-50 text-sm">
                Continue & Save Scan
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

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
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input
        className="w-full border rounded-md px-3 py-2 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ScanSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border bg-white p-4">
          <div className="h-4 w-40 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="h-3 w-64 bg-gray-100 rounded mb-2 animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded mb-3 animate-pulse" />
          <div className="h-8 w-36 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ResultCard({ hit }: { hit: ScanHit }) {
  const pct = Math.round(hit.confidence * 100);
  const band =
    pct >= 80 ? "bg-emerald-100 text-emerald-800" :
    pct >= 50 ? "bg-amber-100 text-amber-800" :
                "bg-gray-100 text-gray-700";

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">{hit.category}</div>
          <a
            href={hit.url}
            target="_blank"
            rel="noreferrer"
            className="text-base font-medium underline underline-offset-2"
          >
            {hit.broker}
          </a>
          <div className="mt-1 text-xs text-gray-600">
            Matched: {hit.matchedFields.join(", ")}
          </div>
        </div>

        <span className={`px-2 py-1 rounded-full text-xs font-medium ${band}`}>
          Confidence {pct}%
        </span>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full bg-gray-100 rounded">
          <div
            className="h-2 bg-black/80 rounded"
            style={{ width: `${Math.max(5, pct)}%` }}
            aria-hidden
          />
        </div>
      </div>

      {hit.evidence?.length ? (
        <ul className="mt-3 list-disc ml-5 text-xs text-gray-700 space-y-1">
          {hit.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/login"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Start automated removal
        </Link>
        <Link
          href="/requests/new"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Create manual request
        </Link>
      </div>
    </div>
  );
}
