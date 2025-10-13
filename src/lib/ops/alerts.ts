// src/lib/ops/alerts.ts
export type AlertPayload = {
  type: "WEBFORM_FAILURE_SPIKE";
  windowMinutes: number;
  totalFailed: number;
  byDomain: Record<string, number>;
  at: string; // ISO
};

export async function sendAlert(payload: AlertPayload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return; // silently skip if not configured
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[alerts] webhook send failed:", (e as any)?.message || e);
  }
}
