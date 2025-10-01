// lib/chunk.ts
export function chunkText(input: string, maxLen = 1200, overlap = 150): string[] {
  if (!input) return [];
  const clean = input.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + maxLen, clean.length);
    let slice = clean.slice(i, end);

    // try to end at a sentence boundary within the last 120 chars
    let cut = slice.lastIndexOf(". ");
    if (cut < slice.length - 120 && end !== clean.length) cut = -1;
    if (cut > 0) slice = slice.slice(0, cut + 1);

    chunks.push(slice);
    if (end === clean.length) break;
    i += (slice.length - overlap > 0 ? slice.length - overlap : slice.length);
  }
  return chunks;
}
