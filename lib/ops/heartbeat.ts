/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Minimal heartbeat utility.
 * - Accepts ANY string topic (no restrictive union).
 * - Returns a resolved Promise so callers can `await beat(...)` safely.
 * - No external dependencies. No DB writes (avoids runtime coupling).
 * - Optional debug logging when DEBUG_BEAT=1.
 *
 * Usage:
 *   await beat("admin.flags:get");
 *   await beat("detect.changes", { route: "/api/..." });
 */

export type BeatTopic = string;

export async function beat(topic: BeatTopic, meta?: Record<string, any>): Promise<void> {
  if (!topic) return; // guard

  if (process.env.DEBUG_BEAT === "1") {
    try {
      // eslint-disable-next-line no-console
      console.debug(`[beat] ${new Date().toISOString()} topic=${topic}`, meta ?? {});
    } catch {
      // swallow any logging errors
    }
  }

  // Intentionally no DB/network side effects.
}
