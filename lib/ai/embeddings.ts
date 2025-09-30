export async function embedAll(chunks: string[]): Promise<number[][]> {
  if (!chunks.length) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for embeddings");

  // Model: text-embedding-3-small (1536 dims); adjust SQL if you change this
  const model = "text-embedding-3-small";

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: chunks }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed: ${res.status} ${err}`);
  }
  const json = await res.json();
  return (json.data ?? []).map((d: any) => d.embedding as number[]);
}
