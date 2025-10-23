// app/(auth)/login/page.tsx
"use client";

import * as React from "react";

export default function LoginPage() {
  return (
    <div className="container" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <div className="card" style={{ width: 420, padding: 22 }}>
        <h1 className="h2">Welcome back</h1>
        <p className="lead" style={{ marginTop: 6 }}>Sign in to your Unlistin account.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = "/(app)/dashboard"; // wire to real auth when ready
          }}
          style={{ display: "grid", gap: 10, marginTop: 12 }}
        >
          <label>
            <div>Email</div>
            <input className="input" type="email" required placeholder="you@example.com" />
          </label>
          <label>
            <div>Password</div>
            <input className="input" type="password" required placeholder="••••••••" />
          </label>
          <button className="btn btn-primary" type="submit">Sign in</button>
        </form>

        <div className="divider" />
        <div className="muted">
          New here? <a className="nav-link" href="/(auth)/signup">Create an account</a>
        </div>
      </div>
    </div>
  );
}
