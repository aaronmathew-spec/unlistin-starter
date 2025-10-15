// src/lib/observability/logger.ts
type Level = "debug" | "info" | "warn" | "error";

function base(meta?: Record<string, unknown>) {
  return {
    ts: new Date().toISOString(),
    ...meta,
  };
}

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  const payload = { level, msg, ...base(meta) };
  // Keep it console-native for Vercel; upgrade later to Datadog/Grafana/OTEL
  // eslint-disable-next-line no-console
  (console as any)[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify(payload)
  );
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
