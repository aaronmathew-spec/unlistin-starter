// app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      // TODO: Replace with your auth API call
      await new Promise((r) => setTimeout(r, 800));
      setMsg("If this email exists, a sign-in link has been sent.");
    } catch (e) {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
      <div className="text-center">
        <div className="text-xs text-[color:var(--muted)]">Welcome to</div>
        <h1 className="text-xl font-semibold tracking-tight">Unlistin</h1>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Work Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="btn w-full"
          aria-busy={busy}
        >
          {busy ? "Sending…" : "Continue"}
        </button>

        {msg ? (
          <div className="text-sm text-[color:var(--muted)] text-center">{msg}</div>
        ) : null}
      </form>

      <div className="mt-4 text-center text-sm">
        <Link className="text-[color:var(--muted)] hover:underline" href="/">
          Back to site
        </Link>
      </div>
    </div>
  );
}
