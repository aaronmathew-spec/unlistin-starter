// src/components/site/SiteHeader.tsx
import Link from "next/link";
import { cookies } from "next/headers";

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  const palette =
    tone === "ok"
      ? { bg: "rgba(16,185,129,.12)", bd: "rgba(16,185,129,.3)", fg: "#059669" }
      : tone === "warn"
      ? { bg: "rgba(245,158,11,.12)", bd: "rgba(245,158,11,.3)", fg: "#b45309" }
      : { bg: "rgba(107,114,128,.12)", bd: "rgba(107,114,128,.3)", fg: "#374151" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${palette.bd}`,
        background: palette.bg,
        color: palette.fg,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export async function SiteHeader() {
  // Lightweight “auth”/context hints without introducing a user system:
  const c = cookies();
  const org = c.get("org_id")?.value || null;
  const ops = c.get("ops")?.value || null;
  const configuredOps = (process.env.OPS_DASHBOARD_TOKEN || "").trim();
  const opsEnabled = !!configuredOps;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "saturate(120%) blur(8px)",
        background: "rgba(255,255,255,.78)",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/" style={{ textDecoration: "none", fontWeight: 900, fontSize: 18, color: "#111827" }}>
            UnlistIN
          </Link>
          <nav style={{ display: "flex", gap: 12 }}>
            <Link className="btn btn-ghost" href="/scan/quick">Quick Scan</Link>
            <Link className="btn btn-ghost" href="/coverage">Coverage</Link>
            <Link className="btn btn-ghost" href="/billing">Billing</Link>
            <Link className="btn btn-ghost" href="/help">Help</Link>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {org ? <Chip tone="ok">Org: {org}</Chip> : <Chip>Org: guest</Chip>}
          {opsEnabled ? (
            ops ? (
              <Link href="/ops/webform/queue" title="Open Ops Console" style={{ textDecoration: "none" }}>
                <Chip tone="ok">Ops</Chip>
              </Link>
            ) : (
              <Link href="/ops/login" title="Login to Ops" style={{ textDecoration: "none" }}>
                <Chip>Ops</Chip>
              </Link>
            )
          ) : null}
        </div>
      </div>
    </header>
  );
}
