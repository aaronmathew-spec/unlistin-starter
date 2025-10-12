/* lib/otp.ts */

type OtpResponse = {
  code?: string;
  provider?: string | null;
  source_message_id?: string | null;
  created_at?: string | null;
  request_id?: string | null | number;
  matched_on?: "correlation_hint" | "uuid" | string | null;
  ok?: boolean;
};

function base(): string {
  // Prefer configured base; fallback to same-origin in browser; final fallback empty
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/** Fetch the latest OTP once (non-blocking). */
export async function getOtp(params: {
  requestId: number | string;
  withinMinutes?: number;
}): Promise<OtpResponse> {
  const url = `${base()}/api/otp/get`;
  const body = {
    request_id: String(params.requestId),
    within_minutes: params.withinMinutes ?? 30,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    // Do not throw; surface a soft error to the UI instead
    return { ok: false };
  }
  const json = (await res.json()) as OtpResponse;
  return json;
}

type WaitForOtpParams = {
  requestId: number | string;
  /** overall timeout in ms (default 60s) */
  timeoutMs?: number;
  /** poll interval in ms (default 2500ms) */
  pollMs?: number;
  /** back-compat alias for pollMs (some callers use this name) */
  pollIntervalMs?: number;
  /** how far back to look when matching (default 30min) */
  withinMinutes?: number;
  /** optionally override base url (rarely needed) */
  baseUrl?: string;
};

/**
 * Block (via polling) until an OTP is available or timeout elapsed.
 * Intended for pages like /requests/[id]/verify or demo/otp.
 */
export async function waitForOtp(params: WaitForOtpParams): Promise<OtpResponse> {
  const timeoutMs = Math.max(2_000, params.timeoutMs ?? 60_000);

  // Accept both names; prefer explicit pollMs when both provided
  const pollMs = Math.max(
    500,
    typeof params.pollMs === "number"
      ? params.pollMs
      : typeof params.pollIntervalMs === "number"
      ? params.pollIntervalMs
      : 2_500
  );

  const start = Date.now();

  // If the API provides a blocking endpoint (/api/otp/wait), try that first.
  const tryBlockingOnce = async (): Promise<OtpResponse | null> => {
    const origin = (params.baseUrl || base()).replace(/\/+$/, "");
    if (!origin) return null;
    try {
      const res = await fetch(`${origin}/api/otp/wait`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_id: String(params.requestId),
          within_minutes: params.withinMinutes ?? 30,
          timeout_ms: Math.min(timeoutMs, 25_000), // keep server wait reasonable
          poll_ms: pollMs,
        }),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as OtpResponse;
      if (json?.code) return json;
      return null;
    } catch {
      return null;
    }
  };

  // First attempt: blocking call (if implemented in your API)
  const first = await tryBlockingOnce();
  if (first?.code) return first;

  // Fallback: client-side polling of /api/otp/get
  for (;;) {
    const got = await getOtp({
      requestId: params.requestId,
      withinMinutes: params.withinMinutes ?? 30,
    });
    if (got?.code) return got;

    if (Date.now() - start > timeoutMs) {
      return { ok: false };
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/**
 * (Optional) Ask the server to rescan recent mail for OTPs.
 * Useful if you want a manual “refresh” button in admin/dev tools.
 */
export async function scanRecentMail(params?: { sinceMinutes?: number; limit?: number }) {
  const origin = base();
  if (!origin) return { ok: false };
  const res = await fetch(`${origin}/api/otp/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      since_minutes: params?.sinceMinutes ?? 60,
      limit: params?.limit ?? 50,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false };
  return res.json();
}

export default {
  waitForOtp,
  getOtp,
  scanRecentMail,
};
