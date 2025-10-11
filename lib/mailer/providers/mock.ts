import type { ProviderInput, ProviderResult } from "./types";

/**
 * Mock provider — does nothing except pretend to send successfully
 * when a sink address is provided (DEV_MAIL_SINK or MAIL_TO).
 */
export async function sendWithMock(msg: ProviderInput): Promise<ProviderResult> {
  const to = msg.to?.trim();
  if (!to) {
    return { ok: false, error: "no-sink-configured (set DEV_MAIL_SINK or MAIL_TO)" };
  }
  // Simulate latency
  await new Promise((r) => setTimeout(r, 10));
  return { ok: true, id: "mock-" + Date.now().toString(36) };
}
