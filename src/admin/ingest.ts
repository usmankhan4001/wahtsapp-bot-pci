import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { vectorStore, type VectorRecord } from "../rag/store.js";
import { embedText } from "../rag/embeddings.js";
import { logger } from "../logger.js";
import { unlinkSync } from "node:fs";

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

/**
 * Extracts text from a PDF via Gemini File API, chunks it, embeds it,
 * and adds it to the vector store.
 */
export async function ingestPdf(filePath: string, projectName: string, originalName: string) {
  let fileObj: any;
  try {
    logger.info(`Uploading ${originalName} to Gemini File API...`);
    fileObj = await ai.files.upload({ file: filePath, config: { mimeType: "application/pdf" } });
    
    // Poll until processing is complete
    let uploadedFile = await ai.files.get({ name: fileObj.name });
    while (uploadedFile.state === "PROCESSING") {
      await new Promise((r) => setTimeout(r, 2000));
      uploadedFile = await ai.files.get({ name: fileObj.name });
    }
    if (uploadedFile.state === "FAILED") {
      throw new Error("Gemini File API processing failed.");
    }

    logger.info(`Extracting text from ${originalName}...`);
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: fileObj.uri, mimeType: fileObj.mime_type || "application/pdf" } },
            { text: "Extract all text from this brochure, including tabular data, pricing, layouts, and features. Output clean, plain text." }
          ]
        }
      ]
    });

    const fullText = response.text || "";
    if (!fullText) {
      throw new Error("No text was extracted from the PDF.");
    }

    logger.info(`Chunking and embedding text for ${projectName}...`);
    // Basic chunking: split by double newlines or large paragraphs
    const rawChunks = fullText.split(/\n\s*\n/);
    let chunks: string[] = [];
    let currentChunk = "";
    
    for (const piece of rawChunks) {
      if ((currentChunk + piece).length > 1500) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = piece;
      } else {
        currentChunk += "\n\n" + piece;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    // Embed all chunks
    const records: VectorRecord[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const cText = chunks[i];
      if (!cText) continue;
      // In production, consider batch embedding or Promise.all
      const e = await embedText(cText);
      records.push({
        id: `chunk-${Date.now()}-${i}`,
        project: projectName,
        source: originalName,
        text: cText,
        embedding: e,
      });
    }

    // Update store
    vectorStore.add(records);
    vectorStore.save();
    logger.info(`Successfully ingested ${records.length} chunks for ${projectName}.`);

  } finally {
    // Cleanup local file
    try {
      unlinkSync(filePath);
    } catch (e) {
      logger.warn(`Failed to delete local temp file ${filePath}`, e);
    }
    // Cleanup Gemini file
    if (fileObj?.name) {
      try {
        await ai.files.delete({ name: fileObj.name });
      } catch (e) {
        logger.warn(`Failed to delete Gemini file ${fileObj.name}`, e);
      }
    }
  }
}
