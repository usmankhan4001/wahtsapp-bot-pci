// Retrieval: embed the question, pull the most relevant brochure chunks.
import { embedText } from "./embeddings.js";
import { vectorStore } from "./store.js";
import { logger } from "../logger.js";

export interface RetrievedChunk {
  project: string;
  source: string;
  text: string;
}

/**
 * Retrieve top-k brochure chunks relevant to `query`. Returns [] if the index
 * is empty or embedding fails (caller should degrade gracefully).
 */
export async function retrieve(query: string, project?: string, k = 5): Promise<RetrievedChunk[]> {
  if (vectorStore.size === 0) return [];
  try {
    const qv = await embedText(query);
    return vectorStore
      .search(qv, k, project)
      .map((r) => ({ project: r.project, source: r.source, text: r.text }));
  } catch (err) {
    logger.warn("RAG retrieve failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
