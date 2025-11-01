// src/components/site/SiteFooter.tsx
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid #e5e7eb",
        background: "#fff",
        marginTop: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          © {new Date().getFullYear()} UnlistIN · Verifiable Privacy Ops
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link className="btn btn-ghost" href="/legal">Legal</Link>
          <Link className="btn btn-ghost" href="/verify">Verify Proof</Link>
        </div>
      </div>
    </footer>
  );
}
