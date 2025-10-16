// app/ops/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const runtime = "nodejs";           // same as rest of your app
export const dynamic = "force-dynamic";    // avoids static-prerender with search params

export default function OpsLoginPage() {
  return (
    <main style={{ padding: 24, maxWidth: 420, margin: "10vh auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Ops · Login</h1>
      <p style={{ opacity: 0.8, marginBottom: 14 }}>
        Enter the one-time admin token to access Ops dashboards.
      </p>

      {/* useSearchParams in a client component must be wrapped in Suspense */}
      <Suspense fallback={<div>Loading…</div>}>
        <LoginClient />
      </Suspense>
    </main>
  );
}
