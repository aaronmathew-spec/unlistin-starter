// app/actions/send-controller-request.ts
"use server";

import { sendControllerRequest } from "@/lib/dispatch/send";
import type { ControllerRequestInput } from "@/lib/dispatch/types";
import { redactForLogs } from "@/lib/pii/redact";

/**
 * Server Action wrapper so UI can trigger dispatch safely (no secrets client-side).
 * Returns a structured result that your UI can render.
 */
export async function sendControllerRequestAction(input: ControllerRequestInput) {
  // Optional: add your isAdmin() / isAuthenticated() guard here if this is admin-only
  // if (!await isAdmin()) return { ok: false, error: "forbidden" };

  // Safe log with redaction
  // eslint-disable-next-line no-console
  console.info("[actions.sendControllerRequestAction.in]", redactForLogs(input, { keys: ["email", "phone"] }));

  const res = await sendControllerRequest(input);

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("[actions.sendControllerRequestAction.out]", redactForLogs(res));
    return { ok: false as const, error: res.error, hint: res.hint ?? null };
  }

  // eslint-disable-next-line no-console
  console.info("[actions.sendControllerRequestAction.out]", redactForLogs(res));
  return { ok: true as const, channel: res.channel, providerId: res.providerId ?? null, note: res.note ?? null };
}
