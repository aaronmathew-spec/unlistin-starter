// app/ti/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type Hit = {
  source: string;
  domain: string;
  url: string;
  risk: "low" | "medium" | "high";
  note?: string;
};

export default function TIPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setLoading(true);
    setError(null);
    setHits([]);
    const res = await fetch("/api/ti/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        username: username.trim() || undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) {
      setError(j?.error || "Preview failed");
    } else {
      setHits(j.hits || []);
    }
    setLoading(false);
  }

  function RiskPill({ r }: { r: Hit["risk"] }) {
    const color =
      r === "high" ? "bg-red-100 text-red-800 border-red-200" :
      r === "medium" ? "bg-amber-100 text-amber-800 border-amber-200" :
      "bg-emerald-100 text-emerald-800 border-emerald-200";
    return <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>{r}</span>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Threat Intel Preview</h1>
        <div className="flex items-center gap-2">
          <Link href="/" className="px-3 py-1 rounded border hover:bg-gray-50">Dashboard</Link>
          <Link href="/requests" className="px-3 py-1 rounded border hover:bg-gray-50">Requests</Link>
        </div>
      </header>

      <section className="rounded-2xl border p-5 space-y-4">
        <div className="text-sm text-gray-600">
          India-first dark-web / leak indicators — <em>no scraping, no PII stored.</em> We only generate safe,
          allowlisted preview links.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="border rounded-xl px-3 py-2"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="border rounded-xl px-3 py-2"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (optional)"
            className="border rounded-xl px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runPreview}
            disabled={loading || (!email && !phone && !username)}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Checking…" : "Run preview"}
          </button>
          <div className="text-xs text-gray-500">Provide any one field.</div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </section>

      {/* Results */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hits.map((h, i) => (
          <div key={i} className="rounded-2xl border p-4 hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <div className="font-medium">{h.source}</div>
              <RiskPill r={h.risk} />
            </div>
            <div className="mt-1 text-xs text-gray-500">{h.domain}</div>
            {h.note && <div className="mt-2 text-sm text-gray-700">{h.note}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={h.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
              >
                View preview
              </a>
              <Link
                href={`/requests/new?broker=${encodeURIComponent(h.source)}&url=${encodeURIComponent(h.url)}&category=Threat%20Intel`}
                className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
              >
                Create removal draft
              </Link>
            </div>
          </div>
        ))}
        {hits.length === 0 && !loading && !error && (
          <div className="text-gray-600 text-sm">No results yet. Run a preview above.</div>
        )}
      </section>
    </div>
  );
}
