// app/(app)/dashboard/page.tsx
export const dynamic = "force-dynamic";

export default function Dashboard() {
  return (
    <div className="container" style={{ padding: 0 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="h1">Dashboard</h1>
        <div className="row">
          <a className="btn btn-primary" href="/ops/overview">New Request</a>
          <a className="btn btn-ghost" href="/ops/proofs/verify">Verify Bundle</a>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card col-6">
          <div className="h3">Recent Proofs</div>
          <div className="divider" />
          <p className="lead">Export CSV or verify bundles from Ops &rarr; Proofs.</p>
          <a className="btn" href="/ops/proofs">Open Proof Ledger</a>
        </div>
        <div className="card col-6">
          <div className="h3">System</div>
          <div className="divider" />
          <p className="lead">Check job health, cron, and email from System Status.</p>
          <a className="btn" href="/ops/system">Open System Status</a>
        </div>
      </div>
    </div>
  );
}
