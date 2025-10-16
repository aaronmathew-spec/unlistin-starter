// app/ops/layout.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export default function OpsLayout({ children }: { children: ReactNode }) {
  const linkStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    textDecoration: "none",
    color: "#111",
    background: "white",
  };

  return (
    <div style={{ display: "grid", gap: 18, padding: 20 }}>
      <header style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/ops/health" style={linkStyle}>Health</Link>
        <Link href="/ops/controllers/overrides" style={linkStyle}>Overrides</Link>
        <Link href="/ops/webforms" style={linkStyle}>Webforms</Link>
        <Link href="/ops/pipeline/auto" style={linkStyle}>Auto-Dispatch</Link>
        <Link href="/ops/verify" style={linkStyle}>Verify</Link>
      </header>
      <section>{children}</section>
    </div>
  );
}
