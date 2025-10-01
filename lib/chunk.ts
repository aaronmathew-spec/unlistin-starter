// lib/chunk.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Ultra-simple text chunker: greedy split on paragraphs, then enforce max length.
 * Tweak as you like (e.g., token-aware with tiktoken).
 */
export function chunkText(input: string, maxLen = 1200): { index: number; text: string }[] {
  if (!input) return [];
  const paras = input
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: { index: number; text: string }[] = [];
  let idx = 0;

  for (const para of paras) {
    if (para.length <= maxLen) {
      out.push({ index: idx++, text: para });
      continue;
    }
    // hard wrap long paras
    for (let i = 0; i < para.length; i += maxLen) {
      out.push({ index: idx++, text: para.slice(i, i + maxLen) });
    }
  }
  return out;
}
