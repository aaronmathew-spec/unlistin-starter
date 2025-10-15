// lib/retry/backoff.ts
/**
 * Jittered exponential backoff for API/webform workers.
 * - Adds AbortSignal support for cancellation
 * - Adds predicate `retryOn` to limit retries to retryable errors
 */

export type BackoffOptions = {
  tries?: number;          // total attempts (default 3)
  baseMs?: number;         // base delay (default 500ms)
  factor?: number;         // multiplier (default 2)
  jitter?: boolean;        // add jitter (default true)
  signal?: AbortSignal;    // optional cancellation signal
  /**
   * Predicate that decides whether to retry on a given error/response.
   * - If error has { status: number }, retry on 429 or 5xx by default.
   * - If it's a TypeError/NetworkError (no status), treat as retryable.
   */
  retryOn?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
};

function defaultRetryOn(err: unknown): boolean {
  const anyErr: any = err;
  const status = anyErr?.status ?? anyErr?.code;
  if (typeof status === "number") {
    if (status === 429) return true;
    if (status >= 500 && status < 600) return true;
    return false;
  }
  return true;
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: BackoffOptions = {}
): Promise<T> {
  const tries = Math.max(1, opts.tries ?? 3);
  const base = opts.baseMs ?? 500;
  const factor = opts.factor ?? 2;
  const jitter = opts.jitter ?? true;
  const retryOn = opts.retryOn ?? defaultRetryOn;
  const signal = opts.signal;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt < tries) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Operation aborted"), { code: "ABORT_ERR" });
    }

    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt++;

      if (attempt >= tries || !retryOn(err)) {
        break;
      }

      const delayBase = base * Math.pow(factor, attempt - 1);
      const delay = jitter ? Math.round(delayBase * (0.5 + Math.random())) : delayBase;

      try {
        opts.onRetry?.(attempt, err, delay);
      } catch {}

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => resolve(), delay);
        if (signal) {
          const onAbort = () => {
            clearTimeout(t);
            reject(Object.assign(new Error("Operation aborted"), { code: "ABORT_ERR" }));
          };
          if (signal.aborted) onAbort();
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
  }
  throw lastErr;
}
