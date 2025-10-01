// lib/obs/trace.ts
/**
 * Tiny tracing helper (no external deps).
 * Wrap route handlers and record duration + basic attributes.
 */
import { log } from "@/lib/obs/logger";

export type SpanAttrs = Record<string, string | number | boolean | null | undefined>;

export async function withTrace<T>(
  name: string,
  attrs: SpanAttrs,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = Date.now();
  try {
    const res = await fn();
    const ms = Date.now() - t0;
    await log({ level: "info", msg: "trace", span: name, ms, ...attrs });
    return res;
  } catch (err: any) {
    const ms = Date.now() - t0;
    await log({ level: "error", msg: "trace_error", span: name, ms, error: err?.message ?? String(err), ...attrs });
    throw err;
  }
}
