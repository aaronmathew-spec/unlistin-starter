// app/ops/pipeline/auto/page.tsx
import "server-only";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Server Action for the form. IMPORTANT: Form actions must return void | Promise<void>.
 * We fire the secured API and then revalidate this page so the user sees fresh state.
 */
async function submit(formData: FormData): Promise<void> {
  "use server";

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const locale = (String(formData.get("locale") || "en").trim() === "hi" ? "hi" : "en") as "en" | "hi";
  const limit = Math.max(1, Math.min(5, Number(String(formData.get("limit") || "3")) || 3));

  const payload = { fullName, email, city, locale, limit };

  // call internal secured API
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/pipeline/auto-from-scan`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-secure-cron": process.env.SECURE_CRON_SECRET || "",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => { /* swallow network error for UI; audit is in dispatch_log */ });

  // revalidate this page so any downstream UI/state can reflect changes
  revalidatePath("/ops/pipeline/auto");
}

export default async function AutoScanPage() {
  // simple, static page; any UI state is derived from logs/ops pages
  // (you could also show a "last-run" banner using cookies/headers if desired)
  headers(); // keep this a dynamic route

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Ops · Auto-Scan & Dispatch</h1>
      <p style={{ color: "#6b7280" }}>
        Runs quick discovery, ranks, and auto-dispatches if controller’s auto-dispatch is enabled and the hit meets the
        controller’s confidence threshold (see <code>/ops/controllers</code>).
      </p>

      <form action={submit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Full name</span>
            <input name="fullName" placeholder="Rahul Sharma" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input name="email" placeholder="rahul@example.com" style={inputStyle} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>City</span>
            <input name="city" placeholder="Mumbai" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Locale</span>
            <select name="locale" defaultValue="en" style={inputStyle}>
              <option value="en">en</option>
              <option value="hi">hi</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Top hits</span>
            <input name="limit" type="number" min={1} max={5} defaultValue={3} style={inputStyle} />
          </label>
        </div>

        <button type="submit" style={buttonPrimary}>
          Run auto-scan
        </button>
      </form>

      <div style={{ marginTop: 18, color: "#6b7280", fontSize: 13 }}>
        Tip: tune thresholds in <b>/ops/controllers</b>. Results and idempotency are written to <b>dispatch_log</b>.
        Review at <b>/ops/dispatch/logs</b>.
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  fontSize: 14,
};

const buttonPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
  width: 180,
};
