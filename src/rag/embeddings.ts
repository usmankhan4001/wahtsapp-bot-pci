// Gemini embeddings client (same API key as the chat model).
// Docs: https://ai.google.dev/api/embeddings
import { config } from "../config.js";

const EMBED_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;

/** Embed a single piece of text → vector. Throws on failure. */
export async function embedText(text: string): Promise<number[]> {
  const model = config.gemini.embedModel;
  const res = await fetch(`${EMBED_ENDPOINT(model)}?key=${config.gemini.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) {
    throw new Error(`Embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Embeddings: no vector returned");
  return values as number[];
}

/** Embed many texts sequentially (simple + rate-friendly for small corpora). */
export async function embedAll(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) out.push(await embedText(t));
  return out;
}
