/* Thin client helpers for your OTP endpoints. */

export type OTPResult = {
  code: string;
  provider?: string | null;
  source_message_id?: string | null;
  created_at?: string | null;
  request_id?: string | null;
  matched_on?: "correlation_hint" | "uuid" | string | null;
};

function base() {
  // Works on client and server (NEXT_PUBLIC_BASE_URL recommended)
  return process.env.NEXT_PUBLIC_BASE_URL || "";
}

export async function scanRecentMail(sinceMinutes = 60, limit = 50) {
  const res = await fetch(`${base()}/api/otp/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ since_minutes: sinceMinutes, limit }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`otp/scan failed: ${res.status}`);
  return res.json() as Promise<{ ok: boolean; inserted: number; scanned: number; matches: number }>;
}

export async function getOtpForRequest(requestId: string | number, withinMinutes = 30) {
  const res = await fetch(`${base()}/api/otp/get`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: String(requestId), within_minutes: withinMinutes }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`otp/get failed: ${res.status}`);
  return res.json() as Promise<OTPResult>;
}
