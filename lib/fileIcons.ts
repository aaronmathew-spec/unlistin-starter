/* lib/otp.ts */

/**
 * Fetch the latest OTP code for a request, polling until it appears or times out.
 * Accepts pollMs (canonical) or pollIntervalMs (back-compat with older pages).
 */
export type WaitForOtpOptions = {
  /** request id as number or string */
  requestId: number | string;
  /** total time to wait before giving up (ms) */
  timeoutMs?: number;
  /** how often to poll (ms) */
  pollMs?: number;
  /** @deprecated use pollMs instead */
  pollIntervalMs?: number;
  /** how far back the server should look for OTP e-mails (minutes) */
  withinMinutes?: number;
  /** override base URL (defaults to window.location.origin or NEXT_PUBLIC_BASE_URL) */
  baseUrl?: string;
};

type OtpResponse = {
  code?: string;
  provider?: string;
  source_message_id?: string;
  created_at?: string;
  request_id?: string | number | null;
  matched_on?: "correlation_hint" | "routed_uuid" | string;
};

function resolveBaseUrl(explicit?: string): string {
  if (explicit && explicit.trim().length > 0) return explicit;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return ""; // relative fetch will still work in the browser, but not on the server
}

/**
 * Polls /api/otp/get until an OTP arrives or we hit timeout.
 * Returns the OTP payload (with .code) on success; throws on timeout.
 */
export async function waitForOtp(opts: WaitForOtpOptions): Promise<OtpResponse> {
  const {
    requestId,
    timeoutMs = 20_000,
    withinMinutes = 30,
    baseUrl,
  } = opts;

  // Back-compat: prefer pollMs, but accept pollIntervalMs if provided
  const pollMs =
    typeof opts.pollMs === "number"
      ? opts.pollMs
      : typeof opts.pollIntervalMs === "number"
      ? opts.pollIntervalMs
      : 1_500;

  const base = resolveBaseUrl(baseUrl);
  const url = `${base}/api/otp/get`;

  const body = JSON.stringify({
    request_id: String(requestId),
    within_minutes: withinMinutes,
  });

  const deadline = Date.now() + timeoutMs;

  while (true) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    if (res.ok) {
      const json = (await res.json()) as OtpResponse;
      if (json?.code && String(json.code).length > 0) {
        return json;
      }
    }

    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for OTP");
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/**
 * Convenience: single shot check (no polling). Useful if you just want the latest code
 * without waiting.
 */
export async function getOtpOnce(
  requestId: number | string,
  withinMinutes = 30,
  baseUrl?: string
): Promise<OtpResponse | null> {
  const base = resolveBaseUrl(baseUrl);
  const res = await fetch(`${base}/api/otp/get`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      request_id: String(requestId),
      within_minutes: withinMinutes,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as OtpResponse;
  return json?.code ? json : null;
}
