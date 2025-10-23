"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  return (
    <main>
      <div className="bg-glow" aria-hidden />
      <div className="hero">
        <div className="hero-card glass" style={{ maxWidth: 560 }}>
          <span className="pill">Welcome back</span>
          <h1 className="hero-title">Sign in to continue</h1>
          <p className="sub">Minimal info in, maximum privacy out. No marketing. No trackers.</p>

          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              // plug your real auth here; keeping UI-only to avoid wiring changes
              window.location.href = "/dashboard";
            }}
          >
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <div style={{ height: 12 }} />

            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              required
            />

            <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
              <button className="btn btn-lg" type="submit">Sign In</button>
              <Link className="btn btn-ghost btn-lg" href="/">Back home</Link>
            </div>
          </form>

          <div className="chips">
            <span className="chip">CSP & RLS enforced</span>
            <span className="chip">Short-lived sessions</span>
          </div>
        </div>
      </div>
    </main>
  );
}
