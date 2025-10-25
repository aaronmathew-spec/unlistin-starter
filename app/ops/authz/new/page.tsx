// app/ops/authz/new/page.tsx
// Server-rendered "New Authorization" form (no client JS). Posts to our local submit route.

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const get = (sp: SP, k: string) => String(sp[k] || "").trim();

export default async function Page({ searchParams }: { searchParams: SP }) {
  const region = (get(searchParams, "region") || "IN").toUpperCase();

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · New Authorization</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Create an authorization record (LoA & ID upload optional; you can attach later).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/ops/authz/list"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            ← List
          </a>
          <a
            href="/ops"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Ops Home
          </a>
        </div>
      </div>

      <form method="POST" action="/ops/authz/new/submit" style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "white",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {/* Subject */}
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Full Name *</label>
            <input
              name="fullName"
              required
              placeholder="Aarav Shah"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Subject ID (optional)</label>
            <input
              name="subjectId"
              placeholder="user_123"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Email</label>
            <input
              name="email"
              placeholder="aarav@example.com"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Phone</label>
            <input
              name="phone"
              placeholder="+91-98xxxxxxx"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Region (ISO)</label>
            <input
              name="region"
              defaultValue={region}
              placeholder="IN"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          {/* Signer & consent */}
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Signer Name *</label>
            <input
              name="signerName"
              required
              placeholder="Ops Agent Name"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Signed At *</label>
            <input
              name="signedAt"
              required
              defaultValue={new Date().toISOString()}
              placeholder="2025-01-01T12:00:00.000Z"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Consent Text *</label>
            <textarea
              name="consentText"
              required
              placeholder="I authorize <Your Company> to act on my behalf for ..."
              rows={6}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
              }}
            />
          </div>

          {/* Optional: evidence URLs to record now (uploads can be attached later in storage UI) */}
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>LoA URL (optional)</label>
            <input
              name="loaUrl"
              placeholder="https://files/loa.pdf"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280" }}>ID Doc URL (optional)</label>
            <input
              name="idUrl"
              placeholder="https://files/id.pdf"
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div style={{ textAlign: "right", gridColumn: "1 / -1" }}>
            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 700,
              }}
            >
              Create Authorization
            </button>
          </div>
        </div>
      </form>

      <p style={{ marginTop: 12, color: "#6b7280" }}>
        Tip: You can later upload artifacts via your storage UI and re-generate a manifest if needed.
      </p>
    </div>
  );
}
