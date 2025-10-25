// app/ops/sla/page.tsx
// Lightweight Ops page: explains the two endpoints and shows example curl.
// No DB calls; just operator guidance.

export const dynamic = "force-dynamic";

export default function OpsSlaPage() {
  const codeStyle: React.CSSProperties = {
    display: "block",
    whiteSpace: "pre-wrap",
    background: "#0b1020",
    color: "#e5e7eb",
    padding: 12,
    borderRadius: 8,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.5,
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Ops · SLA Tools</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Dry-run scan to find overdue dispatches, then (optionally) send reminder emails to controller contacts.
        Emails include the authorization footer automatically.
      </p>

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
          1) Scan Overdue (dry)
        </div>
        <div style={{ padding: 12 }}>
          <p>POST <code>/api/ops/sla/scan</code> (requires header <code>x-secure-cron</code>)</p>
          <pre style={codeStyle}>
{`curl -s -X POST $HOST/api/ops/sla/scan \\
  -H "x-secure-cron: $SECURE_CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{ "lookbackHours": 720, "minAgeHours": 168, "limit": 2000 }' | jq`}
          </pre>
          <p style={{ color: "#6b7280" }}>
            <b>lookbackHours</b> (default 720 = 30d), <b>minAgeHours</b> (default 168 = 7d). Returns a list of{" "}
            <code>controllers</code> with totals and sample rows.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
          2) Auto-Nudge (flag-gated send)
        </div>
        <div style={{ padding: 12 }}>
          <p>POST <code>/api/ops/sla/auto-nudge</code> (requires header <code>x-secure-cron</code>)</p>
          <pre style={codeStyle}>
{`curl -s -X POST $HOST/api/ops/sla/auto-nudge \\
  -H "x-secure-cron: $SECURE_CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tenantId": "default",
    "items": [
      {
        "controllerKey":"naukri",
        "controllerName":"Naukri",
        "subjectUserId":"user_123",
        "subjectFullName":"Test User",
        "subjectEmail":"user@example.com",
        "links":["https://naukri.com/profile/abc"],
        "requestId":"REQ-42",
        "originalSubmittedAt":"2025-10-18T04:00:00.000Z"
      }
    ]
  }' | jq`}
          </pre>
          <p style={{ color: "#6b7280" }}>
            Enable sends with <code>FLAG_SLA_EMAIL_ENABLED=1</code>. Add <code>FLAG_ATTACH_AUTH_MANIFEST=1</code> to
            include the attachment. Set <code>SLA_FROM_EMAIL</code> globally or pass <code>from</code> in the body.
          </p>
        </div>
      </div>
    </div>
  );
}
