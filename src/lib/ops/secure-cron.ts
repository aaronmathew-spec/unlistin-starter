// Secure-cron guard for internal fan-out APIs
// - Checks x-secure-cron header against SECURE_CRON_SECRET
// - Optionally allows same-origin server calls with a secondary secret
//
// Usage in a route:
//   import { assertSecureCron } from "@/lib/ops/secure-cron";
//   const hdr = assertSecureCron(request); // throws Response on failure
//   // proceed...

import { required } from "@/lib/env";

export function assertSecureCron(req: Request): Headers {
  const headers = new Headers(req.headers);
  const incoming = headers.get("x-secure-cron") || "";
  const secret = required("SECURE_CRON_SECRET");

  if (!incoming || incoming !== secret) {
    throw new Response("Unauthorized (secure-cron)", { status: 401 });
  }
  return headers;
}
