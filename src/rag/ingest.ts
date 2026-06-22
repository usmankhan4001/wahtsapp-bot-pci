// Ingestion script: reads media-source/<Project Name>/**.pdf, extracts text,
// chunks it, embeds each chunk with Gemini, and writes data/vectors.json.
//
// Usage (after `npm run build`):  npm run ingest
// Folder convention:  media-source/Box Park-3/brochure.pdf  →  project "Box Park-3"
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { PDFParse } from "pdf-parse";
import { embedText } from "./embeddings.js";
import { VectorStore, type VectorRecord } from "./store.js";

const SOURCE_DIR = "media-source";
const CHUNK_SIZE = 900; // characters
const CHUNK_OVERLAP = 150;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function chunk(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function main(): Promise<void> {
  let projects: string[];
  try {
    projects = readdirSync(SOURCE_DIR).filter((d) => statSync(join(SOURCE_DIR, d)).isDirectory());
  } catch {
    console.error(`No "${SOURCE_DIR}/" directory found. Create it with one folder per project.`);
    process.exit(1);
  }

  const records: VectorRecord[] = [];
  let id = 0;

  for (const project of projects) {
    const files = listFiles(join(SOURCE_DIR, project)).filter((f) => extname(f).toLowerCase() === ".pdf");
    console.log(`\n📁 ${project} — ${files.length} PDF(s)`);
    for (const file of files) {
      try {
        const parser = new PDFParse({ data: new Uint8Array(readFileSync(file)) });
        const result = await parser.getText();
        const chunks = chunk(result.text);
        console.log(`   • ${file} → ${chunks.length} chunks`);
        for (const text of chunks) {
          const embedding = await embedText(text);
          records.push({ id: `c${id++}`, project, source: file, text, embedding });
        }
      } catch (err) {
        console.warn(`   ! Failed ${file}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  const store = new VectorStore(false);
  store.set(records);
  store.save();
  console.log(`\n✅ Ingested ${records.length} chunks from ${projects.length} project(s) → data/vectors.json`);
}

main().catch((e) => {
  console.error("Ingest failed:", e);
  process.exit(1);
});
