/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Super-light audit emitter. In prod you can wire this to a DB or queue.
 * For now it just no-ops unless DEBUG_AUDIT=1 (console.debug).
 */

export function recordAuditEvent(event: string, details?: Record<string, any>) {
  if (process.env.DEBUG_AUDIT === "1") {
    try {
      // eslint-disable-next-line no-console
      console.debug(
        `[audit] ${new Date().toISOString()} ${event}`,
        details ?? {}
      );
    } catch {
      // swallow
    }
  }
}
