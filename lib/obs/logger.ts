// lib/obs/logger.ts
/**
 * Minimal JSON logger with optional Axiom shipping.
 * If AXIOM_INGEST_URL and AXIOM_API_TOKEN are set, logs are POSTed there.
 * Otherwise they go to console.log.
 */
export type LogLevel = "info" | "warn" | "error";
export type LogEvent = {
  level: LogLevel;
  msg: string;
  ts?: string;
  [k: string]: unknown;
};

const AXIOM_URL = process.env.AXIOM_INGEST_URL;
const AXIOM_TOKEN = process.env.AXIOM_API_TOKEN;

export async function log(event: LogEvent): Promise<void> {
  const payload = { ts: new Date().toISOString(), ...event };
  if (AXIOM_URL && AXIOM_TOKEN) {
    try {
      await fetch(AXIOM_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${AXIOM_TOKEN}`,
        },
        body: JSON.stringify(payload),
        // fire-and-forget; do not await errors
      });
    } catch {
      // swallow
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }
}
