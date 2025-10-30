// Minimal structured logger for server routes (NDJSON to stdout).
// - Handles Error objects (name/message/stack) safely
// - Allows creating child loggers with extra context
// - Dependency-free, server-only
//
// Usage:
//   const log = createLogger("ops.dispatch", { requestId });
//   log.info("fanout.start", { keys, region });
//   try { ... } catch (e) { log.error("send.fail", { key, err: e }); }

type Level = "debug" | "info" | "warn" | "error";
type Ctx = Record<string, unknown>;

function serializeError(err: unknown): Ctx {
  if (!err) return {};
  if (err instanceof Error) {
    return {
      err_name: err.name,
      err_message: err.message,
      err_stack: err.stack,
    };
  }
  if (typeof err === "object") {
    try {
      return { err: JSON.parse(JSON.stringify(err)) };
    } catch {
      return { err: String(err) };
    }
  }
  return { err: String(err) };
}

function redact(obj: Ctx): Ctx {
  // Redact common secret-looking keys to avoid accidental leakage
  const REDACT_KEYS = new Set([
    "authorization",
    "x-secure-cron",
    "ops",
    "cookie",
    "apikey",
    "api_key",
    "token",
    "password",
    "secret",
  ]);
  const out: Ctx = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

export function createLogger(component: string, baseCtx?: Ctx) {
  const base = baseCtx ? { ...baseCtx } : {};

  function write(level: Level, event: string, data?: Ctx) {
    const payload: Ctx = {
      ts: new Date().toISOString(),
      lvl: level,
      cmp: component,
      evt: event,
      ...base,
      ...(data ? redact(data) : {}),
    };

    // If an Error object is passed under "error" or "err", expand it
    if (data && (data as any).error) Object.assign(payload, serializeError((data as any).error));
    if (data && (data as any).err) Object.assign(payload, serializeError((data as any).err));

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }

  return {
    child(extra?: Ctx) {
      return createLogger(component, { ...base, ...(extra || {}) });
    },
    debug: (evt: string, d?: Ctx) => write("debug", evt, d),
    info: (evt: string, d?: Ctx) => write("info", evt, d),
    warn: (evt: string, d?: Ctx) => write("warn", evt, d),
    error: (evt: string, d?: Ctx) => write("error", evt, d),
  };
}
