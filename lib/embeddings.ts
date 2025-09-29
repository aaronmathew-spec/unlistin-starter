export type EmbeddingModel = "text-embedding-3-small" | "text-embedding-3-large";

export async function embedText(
  text: string,
  model: EmbeddingModel = "text-embedding-3-small"
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error: ${err}`);
  }

  const json = (await res.json()) as any;
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("No embedding returned");
  return vec as number[];
}
