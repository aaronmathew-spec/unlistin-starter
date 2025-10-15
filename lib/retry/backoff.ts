// lib/retry/backoff.ts
/**
 * Jittered exponential backoff for API/webform workers.
 * Keeps defaults conservative for rate-limited controllers.
 */

export type BackoffOptions = {
  tries?: number;          // total attempts (default 3)
  baseMs?: number;         // base delay (default 500ms)
  factor?: number;         // multiplier (default 2)
  jitter?: boolean;        // add jitter (default true)
  onRetry?: (attempt: number, err: unknown) => void;
};

export async function retry<T>(
  fn: () => Promise<T>,
  opts: BackoffOptions = {}
): Promise<T> {
  const tries = Math.max(1, opts.tries ?? 3);
  const base = opts.baseMs ?? 500;
  const factor = opts.factor ?? 2;
  const jitter = opts.jitter ?? true;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt < tries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt++;
      if (attempt >= tries) break;

      const delayBase = base * Math.pow(factor, attempt - 1);
      const delay = jitter ? Math.round(delayBase * (0.5 + Math.random())) : delayBase;

      if (opts.onRetry) {
        try { opts.onRetry(attempt, err); } catch {}
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
