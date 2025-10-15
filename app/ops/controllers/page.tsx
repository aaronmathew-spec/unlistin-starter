// app/ops/controllers/page.tsx
import { listControllerMetas } from "@/lib/controllers/store";
import { actionUpsert } from "./actions";

export const dynamic = "force-dynamic";

function Row({
  c,
}: {
  c: {
    key: string;
    name?: string;
    preferred: string;
    slaTargetMin?: number;
    formUrl?: string;
    autoDispatchEnabled?: boolean;
    autoDispatchMinConf?: number;
  };
}) {
  return (
    <form
      action={actionUpsert}
      style={{
        display: "grid",
        gridTemplateColumns: "120px 120px 120px 1fr 90px 120px 110px",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input type="hidden" name="key" value={c.key} />
      <div style={{ fontWeight: 600 }}>{c.key}</div>
      <select
        name="preferred"
        defaultValue={c.preferred}
        style={{ padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      >
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
      <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#111827" }}>
        <input type="checkbox" name="autoDispatchEnabled" defaultChecked={!!c.autoDispatchEnabled} />
        <span style={{ fontSize: 12 }}>auto</span>
      </label>
      <input
        name="autoDispatchMinConf"
        type="number"
        step="0.01"
        min={0}
        max={1}
        defaultValue={c.autoDispatchMinConf ?? 0.92}
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
          marginLeft: 8,
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
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Ops · Controllers</h1>
      <p style={{ color: "#6b7280" }}>
        Runtime overrides. <b>Auto</b> enables confidence-thresholded auto-dispatch straight from discovery.
      </p>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 120px 120px 1fr 90px 120px 110px",
            gap: 8,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <div>key</div>
          <div>preferred</div>
          <div>slaTargetMin</div>
          <div>formUrl</div>
          <div>auto</div>
          <div>minConf</div>
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
              autoDispatchEnabled: c.autoDispatchEnabled,
              autoDispatchMinConf: c.autoDispatchMinConf,
            }}
          />
        ))}
      </div>

      <div style={{ marginTop: 18, color: "#6b7280", fontSize: 13 }}>
        Tip: start with higher thresholds (e.g., 0.94+) and reduce once you observe stable matches.
      </div>
    </div>
  );
}
