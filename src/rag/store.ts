// Lightweight persisted vector store (JSON + in-memory cosine search).
// Fine for a small brochure corpus; swap for pgvector when Postgres is added.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface VectorRecord {
  id: string;
  project: string; // project name this chunk belongs to
  source: string; // file the chunk came from
  text: string;
  embedding: number[];
}

// Committed into the repo/image initially, but now mounted via volume.
const STORE_FILE = "data/vectors.json";

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export class VectorStore {
  private records: VectorRecord[] = [];

  constructor(load = true) {
    if (load) this.load();
  }

  get size(): number {
    return this.records.length;
  }

  set(records: VectorRecord[]): void {
    this.records = records;
  }

  add(records: VectorRecord[]): void {
    this.records.push(...records);
  }

  /** Top-k most similar chunks; optional project filter (fuzzy). */
  search(queryEmbedding: number[], k = 5, project?: string): VectorRecord[] {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const pf = project ? norm(project) : "";
    const pool = pf
      ? this.records.filter((r) => norm(r.project).includes(pf) || pf.includes(norm(r.project)))
      : this.records;
    const base = pool.length ? pool : this.records; // fall back to all if filter empties
    return base
      .map((r) => ({ r, score: cosine(queryEmbedding, r.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((x) => x.r);
  }

  load(): void {
    try {
      if (existsSync(STORE_FILE)) {
        this.records = JSON.parse(readFileSync(STORE_FILE, "utf8")) as VectorRecord[];
      }
    } catch {
      this.records = [];
    }
  }

  save(): void {
    mkdirSync(dirname(STORE_FILE), { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(this.records));
  }
}

/** Shared instance used at runtime by retrieval. */
export const vectorStore = new VectorStore();
