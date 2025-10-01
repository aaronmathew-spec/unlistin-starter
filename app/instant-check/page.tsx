"use client";
import { useState, useTransition } from "react";
import Link from "next/link";

type Match = {
  broker: string;
  category: string;
  confidence: number;
  selectors: {
    name?: string;
    email_hash?: string;
    phone_hash?: string;
    city?: string;
  };
  preview: string;
};

export default function InstantCheckPage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<"IN" | "GLOBAL">("IN");

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Instant Check (No Storage)</h1>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          Home
        </Link>
      </div>

      <p className="text-sm text-gray-600">
        Enter <strong>either</strong> (Name + City) <strong>or</strong> Email <strong>or</strong> Phone.
        We’ll show a quick snapshot of potential matches. We <strong>do not store</strong> your inputs here.
      </p>

      <form
        className="space-y-4 border rounded-md p-4 bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setMatches(null);
          setNotice(null);

          // minimal validation UI-side, server does the real check too
          if (!((name && city) || email || phone)) {
            setError("Provide either (Name + City) or Email or Phone.");
            return;
          }

          start(async () => {
            try {
              const res = await fetch("/api/instant-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, city, email, phone, region }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json?.error || "Instant check failed");
              setMatches(json.matches || []);
              setNotice(json.notice || null);
            } catch (err: any) {
              setError(err?.message || "Instant check failed");
            }
          });
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="Full name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="City (optional)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value === "GLOBAL" ? "GLOBAL" : "IN")}
          >
            <option value="IN">Region: India</option>
            <option value="GLOBAL">Region: Global</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={pending}
          >
            {pending ? "Checking…" : "Run Instant Check"}
          </button>
          <span className="text-xs text-gray-500">
            We hash sensitive selectors and do not store your inputs for this preview.
          </span>
        </div>
      </form>

      {error && <div className="text-sm text-red-600">Error: {error}</div>}
      {notice && <div className="text-xs text-gray-500">{notice}</div>}

      {matches && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Potential Matches</h2>
          {matches.length === 0 ? (
            <div className="text-sm text-gray-500">No obvious matches in the quick check.</div>
          ) : (
            <ul className="space-y-2">
              {matches.map((m, i) => (
                <li key={i} className="text-sm border rounded p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{m.broker}</div>
                    <div className="text-xs text-gray-500">{m.category}</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Confidence: {(m.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{m.preview}</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {m.selectors.name ? `Name: ${m.selectors.name} · ` : ""}
                    {m.selectors.city ? `City: ${m.selectors.city} · ` : ""}
                    {m.selectors.email_hash ? `Email# ${m.selectors.email_hash.slice(0, 10)}… · ` : ""}
                    {m.selectors.phone_hash ? `Phone# ${m.selectors.phone_hash.slice(0, 10)}…` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2 text-sm text-gray-700">
            Like what you see? For a full removal, create an account and we’ll run a deeper scan and file
            opt-out/DSAR requests automatically (with your consent).
          </div>
        </div>
      )}
    </div>
  );
}
