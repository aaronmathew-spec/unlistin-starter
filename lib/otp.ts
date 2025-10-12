export async function waitForOtp(params: {
  requestId: string | number;
  withinMinutes?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}) {
  const res = await fetch("/api/otp/wait", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      request_id: String(params.requestId),
      within_minutes: params.withinMinutes ?? 30,
      timeout_ms: params.timeoutMs ?? 20000,
      poll_interval_ms: params.pollIntervalMs ?? 2000,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || `waitForOtp failed with ${res.status}`);
  }
  return (await res.json()) as { code: string | null; matched_on?: string; request_id?: string | null };
}
