// app/ops/controllers/page.tsx
import { listControllerMetas } from "@/lib/controllers/store";
import { actionUpsert } from "./actions";

export const dynamic = "force-dynamic";

function Row({ c }: { c: { key: string; name?: string; preferred: string; slaTargetMin?: number; formUrl?: string } }) {
  return (
    <form action={actionUpsert} style={{ display: "grid", gridTemplateColumns: "140px 140px 160px 1fr 120px", gap: 8, alignItems: "center" }}>
      <input type="hidden" name="key" value={c.key} />
      <div style={{ fontWeight: 600 }}>{c.key}</div>
      <select name="preferred" defaultValue={c.preferred} style={{ padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <option value="email">email</option>
        <option value="webform">webform</option>
        <option value="api">api</option>
      </select>
      <input
        name="slaTargetMin"
        type="number"
        min={0}
        defaultValue={c.slaTargetMin ?? 180}
        style={{ padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      />
      <input
        name="formUrl"
        placeholder="https://..."
        defaultValue={c.formUrl || ""}
        style={{ padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      />
      <button
        type="submit"
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #111827",
          background: "#111827",
          color: "white",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Save
      </button>
    </form>
  );
}

export default async function ControllersPage() {
  const items = await listControllerMetas();

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Ops · Controllers</h1>
      <p style={{ color: "#6b7280" }}>
        Live controller overrides. Edits apply without redeploy. Defaults come from code; stored overrides merge on top.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 140px 160px 1fr 120px", gap: 8, fontSize: 12, color: "#6b7280" }}>
          <div>key</div>
          <div>preferred</div>
          <div>slaTargetMin</div>
          <div>formUrl</div>
          <div></div>
        </div>

        {items.map((c) => (
          <Row
            key={c.key}
            c={{
              key: c.key,
              name: c.name,
              preferred: c.preferred,
              slaTargetMin: c.slaTargetMin,
              formUrl: c.formUrl,
            }}
          />
        ))}
      </div>

      <div style={{ marginTop: 18, color: "#6b7280", fontSize: 13 }}>
        Tip: Dispatcher will honor <b>preferred</b> and <b>formUrl</b> when provided (e.g., Truecaller webform). SLA targets feed your alerts.
      </div>
    </div>
  );
}
