// src/agents/dispatch/api.ts

export type ApiDispatchPayload = {
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
};

export type ApiDispatchResult =
  | { ok: true; receipt: string }
  | { ok: false; error: string };

export async function callApi(payload: ApiDispatchPayload): Promise<ApiDispatchResult> {
  if (!payload.endpoint) return { ok: false, error: "Missing endpoint" };
  const method = payload.method || "POST";

  try {
    const res = await fetch(payload.endpoint, {
      method,
      headers: {
        "content-type": "application/json",
        ...(payload.headers || {}),
      },
      body: payload.body ? JSON.stringify(payload.body) : undefined,
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
