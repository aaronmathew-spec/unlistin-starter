// lib/utils/batch.ts

/**
 * Split an array into equally-sized chunks.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const n = Math.max(1, size | 0);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Run an async mapper over items with a max concurrency.
 * Guarantees resolution of all tasks (collects errors instead of throwing).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<{ results: R[]; errors: Array<{ index: number; error: unknown }> }> {
  const pool = Math.max(1, concurrency | 0);
  const results: R[] = [];
  const errors: Array<{ index: number; error: unknown }> = [];
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      try {
        const r = await mapper(items[idx], idx);
        results.push(r);
      } catch (e) {
        errors.push({ index: idx, error: e });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(pool, items.length) }, worker));
  return { results, errors };
}
