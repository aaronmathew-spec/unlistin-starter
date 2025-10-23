// app/(auth)/signup/page.tsx
"use client";

import * as React from "react";

export default function SignupPage() {
  return (
    <div className="container" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <div className="card" style={{ width: 420, padding: 22 }}>
        <h1 className="h2">Create account</h1>
        <p className="lead" style={{ marginTop: 6 }}>Start your verifiable privacy ops.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = "/(app)/dashboard"; // wire to real signup when ready
          }}
          style={{ display: "grid", gap: 10, marginTop: 12 }}
        >
          <label>
            <div>Name</div>
            <input className="input" required placeholder="Your name" />
          </label>
          <label>
            <div>Email</div>
            <input className="input" type="email" required placeholder="you@example.com" />
          </label>
          <label>
            <div>Password</div>
            <input className="input" type="password" required placeholder="Create password" />
          </label>
          <button className="btn btn-primary" type="submit">Create account</button>
        </form>

        <div className="divider" />
        <div className="muted">
          Already have an account? <a className="nav-link" href="/(auth)/login">Sign in</a>
        </div>
      </div>
    </div>
  );
}
