// lib/utils/batch.ts

/**
 * Split an array into equally-sized chunks.
 */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const n = Math.max(1, size | 0);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export type MapWithConcurrencyResult<R> = {
  results: R[];
  errors: Array<{ index: number; error: unknown }>;
};

/**
 * Run an async mapper over items with a max concurrency.
 * Guarantees resolution of all tasks (collects errors instead of throwing).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<MapWithConcurrencyResult<R>> {
  const len = items.length;
  const pool = Math.max(1, concurrency | 0);

  const results: R[] = [];
  const errors: Array<{ index: number; error: unknown }> = [];

  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= len) break;

      // Narrow the type: we know idx < len so this is T, not undefined
      const item = items[idx] as T;

      try {
        const r = await mapper(item, idx);
        results.push(r);
      } catch (e) {
        errors.push({ index: idx, error: e });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(pool, len) },
    () => worker()
  );

  await Promise.all(workers);
  return { results, errors };
}
