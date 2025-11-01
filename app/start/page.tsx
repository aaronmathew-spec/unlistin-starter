"use client";

import { useState } from "react";
import Link from "next/link";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "ok" }
  | { status: "error"; error: string };

export default function StartPage() {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [form, setForm] = useState({
    name: "",
    email: "",
    region: "IN",
    goals: "",
    referral: "",
    // honeypot: must remain empty
    company: "",
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.status === "submitting") return;

    // very light client validation
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setState({ status: "error", error: "Please enter a valid email." });
      return;
    }
    if (form.company) {
      // honeypot triggered: pretend OK silently
      setState({ status: "ok" });
      window.location.href = "/start/thanks";
      return;
    }

    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/public/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          region: form.region,
          goals: form.goals,
          referral: form.referral || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "submit_failed");
      setState({ status: "ok" });
      window.location.href = "/start/thanks";
    } catch (e: any) {
      setState({ status: "error", error: String(e?.message || e) });
    }
  }

  return (
    <main>
      <div className="bg-glow" aria-hidden />
      <div className="hero">
        <div className="hero-card glass" style={{ maxWidth: 840 }}>
          <span className="pill">India-first · Proof-backed</span>
          <h1 className="hero-title">
            Start removing your data — <span className="hero-accent">safely & verifiably</span>
          </h1>
          <p className="sub">
            Tell us what you want removed. We prepare lawful requests, dispatch to controllers, and
            keep signed evidence for your records.
          </p>

          <form onSubmit={onSubmit} className="card" style={{ padding: 16, marginTop: 16 }}>
            {/* honeypot (keep hidden) */}
            <input
              type="text"
              name="company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
              tabIndex={-1}
              aria-hidden
              autoComplete="off"
            />

            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <label className="field" style={{ flex: 1, minWidth: 220 }}>
                <div className="field-label">Name (optional)</div>
                <input
                  className="input"
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label className="field" style={{ flex: 1, minWidth: 220 }}>
                <div className="field-label">Email</div>
                <input
                  className="input"
                  placeholder="you@example.com"
                  inputMode="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <label className="field" style={{ width: 160 }}>
                <div className="field-label">Region</div>
                <select
                  className="input"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                >
                  <option value="IN">India</option>
                  <option value="US">United States</option>
                  <option value="EU">European Union</option>
                  <option value="UK">United Kingdom</option>
                  <option value="SG">Singapore</option>
                  <option value="AU">Australia</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>

            <label className="field" style={{ marginTop: 12 }}>
              <div className="field-label">What would you like to remove? (links, sites, or short note)</div>
              <textarea
                className="input"
                rows={4}
                placeholder="Example: remove my data from XYZ people search and ABC data broker…"
                value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
              />
            </label>

            <label className="field" style={{ marginTop: 12 }}>
              <div className="field-label">Referral (optional)</div>
              <input
                className="input"
                placeholder="Promo code or who referred you"
                value={form.referral}
                onChange={(e) => setForm({ ...form, referral: e.target.value })}
              />
            </label>

            {state.status === "error" ? (
              <div className="panel" style={{ marginTop: 10, borderColor: "#ef4444", background: "#fef2f2", color: "#991b1b" }}>
                {state.error}
              </div>
            ) : null}

            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <button
                type="submit"
                className="btn btn-lg"
                disabled={state.status === "submitting"}
                aria-busy={state.status === "submitting"}
              >
                {state.status === "submitting" ? "Submitting…" : "Get Started"}
              </button>
              <Link href="/" className="btn btn-ghost btn-lg">
                Back to Home
              </Link>
            </div>

            <div className="hero-note" style={{ marginTop: 10 }}>
              We’ll email next steps. We store the minimum required and sign manifests for audit.
            </div>
          </form>

          <div className="chips" style={{ marginTop: 14 }}>
            <span className="chip">Min-data intake</span>
            <span className="chip">Audit-ready proofs</span>
            <span className="chip">Global policy mapping</span>
          </div>
        </div>
      </div>
    </main>
  );
}
