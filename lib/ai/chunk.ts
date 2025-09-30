export function chunkText(input: string, maxLen = 1200): string[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxLen);
    let j = end;
    // try to break on sentence boundary
    const dot = text.lastIndexOf(". ", end);
    if (dot > i + 200) j = dot + 1; // keep sentences
    parts.push(text.slice(i, j).trim());
    i = j;
  }
  return parts;
}
