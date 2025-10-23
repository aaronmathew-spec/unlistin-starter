// app/(app)/layout.tsx
export const dynamic = "force-dynamic";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", minHeight: "70vh" }}>
      <aside
        style={{
          borderRight: "1px solid rgba(255,255,255,.06)",
          background: "#0c121d",
          padding: 10,
          position: "sticky",
          top: 60,
          height: "calc(100dvh - 60px)",
        }}
      >
        <nav style={{ display: "grid", gap: 8 }}>
          <a title="Dashboard" className="nav-link" href="/(app)/dashboard">🏛️</a>
          <a title="Requests" className="nav-link" href="/ops/overview">📬</a>
          <a title="Evidence" className="nav-link" href="/ops/proofs">📦</a>
          <a title="Webforms" className="nav-link" href="/ops/webforms">⚙️</a>
          <a title="Settings" className="nav-link" href="/(app)/settings">⚙</a>
        </nav>
      </aside>
      <section style={{ padding: 20 }}>{children}</section>
    </div>
  );
}
