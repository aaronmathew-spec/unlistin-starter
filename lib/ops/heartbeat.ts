// lib/ops/heartbeat.ts
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
  // Guard: ignore falsy topics
  if (!topic) return;

  // Optional lightweight debug log (disabled by default)
  if (process.env.DEBUG_BEAT === "1") {
    try {
      // Keep logging ultra-safe; don't throw
      // eslint-disable-next-line no-console
      console.debug(
        `[beat] ${new Date().toISOString()} topic=${topic}`,
        meta ?? {}
      );
    } catch {
      // swallow any logging errors
    }
  }

  // Intentionally no DB/network side effects.
  // Add a DB write here later if you want persistent heartbeats.
}
