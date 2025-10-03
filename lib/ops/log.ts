// lib/ops/log.ts
export function slog(scope: string, msg: string, extra?: Record<string, unknown>) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      scope,
      msg,
      ...extra,
    });
    console.log(line);
  } catch {
    // swallow
  }
}
