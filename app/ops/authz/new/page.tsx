// app/ops/authz/new/page.tsx
export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      {children}
    </div>
  );
}

async function createAuthz(formData: FormData) {
  "use server";

  const toB64 = async (f: File | null) =>
    f ? Buffer.from(await f.arrayBuffer()).toString("base64") : null;

  const payload = {
    subject: {
      subjectId: (formData.get("subjectId") as string) || null,
      fullName: (formData.get("fullName") as string) || "",
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      region: (formData.get("region") as string) || "IN",
    },
    signerName: (formData.get("signerName") as string) || "",
    signedAt: new Date().toISOString(),
    consentText:
      (formData.get("consentText") as string) ||
      "I authorize Unlistin to act on my behalf for data subject requests.",
    artifacts: [] as Array<{ filename: string; mime: string; base64: string }>,
  };

  const loa = formData.get("loa") as unknown as File | null;
  const idDoc = formData.get("idDoc") as unknown as File | null;

  if (loa) {
    payload.artifacts.push({
      filename: loa.name,
      mime: loa.type || "application/octet-stream",
      base64: (await toB64(loa))!,
    });
  }
  if (idDoc) {
    payload.artifacts.push({
      filename: idDoc.name,
      mime: idDoc.type || "application/octet-stream",
      base64: (await toB64(idDoc))!,
    });
  }

  const res = await fetch("/api/subject/authorization", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await res.text();
    return { ok: false, error: `http_${res.status}`, detail: msg };
  }
  const j = await res.json();
  return j;
}

export default function Page() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorization Intake</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Upload Letter of Authorization (LoA) and ID evidence. We’ll store files, create the row, and write a signed manifest hash.
          </p>
        </div>
        <a
          href="/ops"
          style={{ textDecoration: "none", border: "1px solid #e5e7eb", padding: "8px 12px", borderRadius: 8, fontWeight: 600 }}
        >
          ← Back
        </a>
      </div>

      <form action={createAuthz} style={{ marginTop: 16 }} encType="multipart/form-data">
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
          <Field label="Full Name *">
            <input name="fullName" required placeholder="Aarav Shah" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </Field>
          <Field label="Subject ID (optional)">
            <input name="subjectId" placeholder="user_123" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </Field>
          <Field label="Email">
            <input name="email" placeholder="aarav@example.com" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </Field>
          <Field label="Phone">
            <input name="phone" placeholder="+91-98xxxxxxx" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </Field>
          <Field label="Region (ISO)">
            <input name="region" defaultValue="IN" placeholder="IN" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </Field>
          <Field label="Signer Name *">
            <input name="signerName" required placeholder="Aarav Shah" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }} />
          </Field>
          <Field label="Consent Text">
            <textarea
              name="consentText"
              placeholder="I authorize Unlistin to act on my behalf…"
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, minHeight: 90 }}
            />
          </Field>
          <div />
          <Field label="Letter of Authorization (PDF/Image)">
            <input name="loa" type="file" accept="application/pdf,image/*" />
          </Field>
          <Field label="ID Proof (Image/PDF)">
            <input name="idDoc" type="file" accept="application/pdf,image/*" />
          </Field>

          <div style={{ gridColumn: "1 / -1", textAlign: "right", marginTop: 8 }}>
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
    </div>
  );
}
