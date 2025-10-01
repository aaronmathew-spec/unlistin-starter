"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

type Match = {
  site: string;
  type: "data_broker" | "social" | "search_engine" | "breach" | "misc";
  url: string;
  confidence: number; // 0..1
  matched_fields: string[];
  preview: string; // redacted
  action?: { label: string; href: string };
};

export default function QuickScanPage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quick Scan (No Data Stored)</h1>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          Home
        </Link>
      </div>

      <p className="text-sm text-gray-600">
        Enter the <strong>minimum</strong> to preview what we can find. We do <strong>not</strong>{" "}
        store your entries for this quick scan.
      </p>

      <form
        className="space-y-4 border rounded-md p-4 bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setResults(null);
          const payload = {
            name: name.trim(),
            city: city.trim(),
            email: email.trim(),
            phone: phone.trim(),
          };
          start(async () => {
            try {
              const res = await fetch("/api/scan/quick", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json?.error || "Scan failed");
              setResults(json.matches || []);
            } catch (err: any) {
              setError(err?.message || "Scan failed");
            }
          });
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Full name*</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g., Aarav Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">City (optional)</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g., Bengaluru"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Email (optional)</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g., you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Phone (optional)</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g., +91 98xxxxxx12"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={pending || name.trim().length < 2}
          >
            {pending ? "Scanning…" : "Run Quick Scan"}
          </button>

          <div className="text-xs text-gray-500">
            We show an indicative preview. Full scan requires sign-in and consent.
          </div>
        </div>
      </form>

      {error && <div className="text-sm text-red-600">Error: {error}</div>}

      {results && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Possible Matches</h2>
          {results.length === 0 ? (
            <div className="text-sm text-gray-500">No obvious matches from the quick scan.</div>
          ) : (
            <ul className="space-y-2">
              {results.map((m, i) => (
                <li key={i} className="border rounded-md p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {m.site} <span className="text-gray-400 text-xs">· {m.type}</span>
                    </div>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline hover:no-underline"
                    >
                      View
                    </a>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Confidence: {(m.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{m.preview}</div>
                  {m.action && (
                    <div className="mt-2">
                      <Link
                        className="text-xs underline hover:no-underline"
                        href={m.action.href}
                      >
                        {m.action.label}
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500">
        This quick scan does not store your inputs. Learn more:{" "}
        <Link href="/docs" className="underline hover:no-underline">
          Docs
        </Link>
      </div>
    </div>
  );
}
