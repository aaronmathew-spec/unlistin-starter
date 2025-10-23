"use client";

import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [notify, setNotify] = useState(true);
  const [locale, setLocale] = useState("en");

  return (
    <main>
      <div className="bg-glow" aria-hidden />
      <div className="container" style={{ padding: 16, maxWidth: 900 }}>
        <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="pill">Profile</div>
            <h1 className="hero-title" style={{ marginTop: 8 }}>Settings</h1>
            <div className="sub">Keep it simple. Only what’s needed to run your requests.</div>
          </div>
          <Link href="/dashboard" className="btn btn-outline btn-lg">Back to Dashboard</Link>
        </header>

        <section className="panel" style={{ marginTop: 16 }}>
          <label className="label">Display name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />

          <div style={{ height: 12 }} />

          <label className="label">Locale</label>
          <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="es">Español</option>
          </select>

          <div style={{ height: 12 }} />

          <label className="label">Notifications</label>
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <span className="sub" style={{ margin: 0 }}>Email status updates and SLA follow-ups</span>
            <button
              className={`btn ${notify ? "" : "btn-outline"}`}
              onClick={() => setNotify((v) => !v)}
              type="button"
            >
              {notify ? "On" : "Off"}
            </button>
          </div>

          <div className="row" style={{ marginTop: 16, justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-ghost" type="button" onClick={() => window.location.reload()}>Cancel</button>
            <button className="btn" type="button" onClick={() => alert("Saved (wire to API later)")}>Save changes</button>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="label">Data controls</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link href="/ops/proofs/export" className="btn btn-outline">Export CSV</Link>
            <Link href="/ops/proofs/verify" className="btn btn-outline">Verify Bundle</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
