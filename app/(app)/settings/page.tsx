// app/(app)/settings/page.tsx
export const dynamic = "force-dynamic";

const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: "grid", gap: 6 }}>
    <div className="muted" style={{ fontWeight: 600 }}>{label}</div>
    {children}
  </label>
);

export default function SettingsPage() {
  return (
    <div className="container" style={{ padding: 0 }}>
      <h1 className="h1">Settings</h1>
      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card col-6">
          <div className="h3">Profile</div>
          <div className="divider" />
          <div style={{ display: "grid", gap: 10 }}>
            <Item label="Name"><input className="input" placeholder="Your name" /></Item>
            <Item label="Email"><input className="input" placeholder="you@example.com" type="email" /></Item>
            <button className="btn btn-primary">Save Profile</button>
          </div>
        </div>
        <div className="card col-6">
          <div className="h3">Security</div>
          <div className="divider" />
          <div style={{ display: "grid", gap: 10 }}>
            <Item label="Change Password">
              <input className="input" type="password" placeholder="New password" />
            </Item>
            <button className="btn">Update Password</button>
          </div>
        </div>

        <div className="card col-6">
          <div className="h3">Notifications</div>
          <div className="divider" />
          <div style={{ display: "grid", gap: 10 }}>
            <label className="row" style={{ alignItems: "center" }}>
              <input type="checkbox" defaultChecked /> <span>Email alerts</span>
            </label>
            <label className="row" style={{ alignItems: "center" }}>
              <input type="checkbox" defaultChecked /> <span>Weekly digests</span>
            </label>
            <button className="btn">Save Preferences</button>
          </div>
        </div>

        <div className="card col-6">
          <div className="h3">Data</div>
          <div className="divider" />
          <div className="row">
            <a className="btn btn-ghost" href="/ops/proofs/export">Export Proof CSV</a>
            <a className="btn btn-ghost" href="/ops/proofs/verify">Verify Bundle</a>
          </div>
        </div>
      </div>
    </div>
  );
}
