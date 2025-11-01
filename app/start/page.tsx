// app/start/page.tsx
/* Customer intake: creates a minimal queued job via /api/public/intake.
   If env flag is off, the page degrades gracefully with instructions. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Box({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        padding: "2px 6px",
        borderRadius: 6,
      }}
    >
      {children}
    </code>
  );
}

const ENABLED = (process.env.NEXT_PUBLIC_PUBLIC_INTAKE || "").toLowerCase() === "1";

export default function Start() {
  const note =
    ENABLED
      ? null
      : "Online intake is currently closed. Please use Contact/Support or reach out to our team to initiate a request.";

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <a href="/" style={{ textDecoration: "none", color: "#111827" }}>← Home</a>
      <h1 style={{ marginTop: 10, marginBottom: 6 }}>Start a data removal</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        Tell us what you want removed and where it appears. We’ll generate compliant requests and keep you updated.
      </p>

      {!ENABLED && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            border: "1px solid #f59e0b",
            background: "#fffbeb",
            color: "#92400e",
            borderRadius: 10,
          }}
        >
          ⚠ {note}
        </div>
      )}

      <form
        method="post"
        action="/api/public/intake"
        style={{
          marginTop: 14,
          border: "1px solid #e5e7eb",
          background: "white",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>Your email (for updates)</label>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            style={{
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>Your name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="Full name"
            style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>Link to the page (URL)</label>
          <input
            name="url"
            type="url"
            required
            placeholder="https://example.com/profile/..."
            style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>Describe what needs removal</label>
          <textarea
            name="description"
            rows={5}
            placeholder="Tell us what’s on the page (text, image, video, sensitive info, etc.)"
            style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>Region</label>
          <select
            name="region"
            defaultValue="IN"
            style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10 }}
          >
            <option value="IN">India (DPDP)</option>
            <option value="US">United States</option>
            <option value="EU">European Union</option>
          </select>
          <div style={{ color: "#6b7280", fontSize: 12 }}>
            We’ll route your request to the right policy templates automatically.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          <button
            type="submit"
            disabled={!ENABLED}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: ENABLED ? "#111827" : "#6b7280",
              color: "white",
              fontWeight: 700,
              cursor: ENABLED ? "pointer" : "not-allowed",
            }}
            title={ENABLED ? "Submit" : "Intake closed"}
          >
            Submit request
          </button>
          <a
            href="/status"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 600,
              background: "white",
              color: "#111827",
            }}
          >
            Check status
          </a>
        </div>
      </form>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Box title="What happens next">
          <ol style={{ margin: 0, paddingLeft: 18, color: "#6b7280" }}>
            <li>We validate the link and content.</li>
            <li>AI drafts a compliant notice; a human reviews it.</li>
            <li>We dispatch to the controller and track responses.</li>
            <li>You’ll see proofs (HTML + screenshot) in your status page.</li>
          </ol>
        </Box>
        <Box title="Transparency">
          <div style={{ color: "#6b7280" }}>
            We keep an audit of actions and mask sensitive data in logs. Learn more on{" "}
            <a href="/why">Why</a>. For support, email <Mono>support@unlistin.example</Mono>.
          </div>
        </Box>
      </div>
    </main>
  );
}
