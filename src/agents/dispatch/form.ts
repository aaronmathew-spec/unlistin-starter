// src/agents/dispatch/form.ts

export type FormDispatchPayload = {
  formUrl: string;
  fields: Record<string, string>;
};

export type FormDispatchResult =
  | { ok: true; receipt: string }
  | { ok: false; error: string };

export async function submitForm(payload: FormDispatchPayload): Promise<FormDispatchResult> {
  if (!payload.formUrl) return { ok: false, error: "Missing formUrl" };

  try {
    // Generic POST as JSON (MVP). You can add urlencoded / multipart variants later.
    const res = await fetch(payload.formUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload.fields),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const receipt = `http:${res.status}`;
    return { ok: true, receipt };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
