// Minimal structured logger for server routes
// Writes NDJSON lines to stdout. Attach requestId to correlate.
//
// Usage:
//   const log = createLogger("ops.dispatch", requestId)
//   log.info("fanout.start", { keys, region })
//   log.error("send.fail", { key, err: String(e) })

type Level = "debug" | "info" | "warn" | "error";

export function createLogger(component: string, requestId?: string | null) {
  function write(level: Level, event: string, data?: Record<string, unknown>) {
    const line = {
      ts: new Date().toISOString(),
      lvl: level,
      cmp: component,
      evt: event,
      rid: requestId || null,
      ...((data || {}) as object),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  }

  return {
    debug: (evt: string, d?: Record<string, unknown>) => write("debug", evt, d),
    info: (evt: string, d?: Record<string, unknown>) => write("info", evt, d),
    warn: (evt: string, d?: Record<string, unknown>) => write("warn", evt, d),
    error: (evt: string, d?: Record<string, unknown>) => write("error", evt, d),
  };
}
