// Gemini REST client with a function-calling loop.
// Includes retry logic with exponential backoff for resilience.
// Docs: https://ai.google.dev/api/generate-content
import { config } from "../config.js";
import { logger } from "../logger.js";
import { buildSystemPrompt } from "./persona.js";
import { executeTool, toolDeclarations, type ToolContext } from "./tools.js";
import { sessions, type Session, type Turn } from "../session/store.js";

interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
interface Content {
  role: "user" | "model";
  parts: Part[];
}

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// ── Retry configuration ────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGeminiWithRetry(contents: Content[], systemPrompt: string): Promise<Content> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT(config.gemini.model)}?key=${config.gemini.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: [{ functionDeclarations: toolDeclarations }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
        }),
      });

      // If retryable error, back off and retry.
      if (RETRYABLE_STATUS.has(res.status)) {
        const body = (await res.text()).slice(0, 200);
        lastError = new Error(`Gemini ${res.status}: ${body}`);
        logger.warn(`Gemini ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES}) — retrying…`);
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      if (!res.ok) {
        throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
      }

      const data = (await res.json()) as any;

      // Handle blocked responses gracefully.
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY") {
        logger.warn("Gemini response blocked by safety filter");
        return { role: "model", parts: [{ text: "I'd be happy to help you with property inquiries. Could you please tell me what you're looking for?" }] };
      }

      const content = data?.candidates?.[0]?.content as Content | undefined;
      if (!content) {
        // Sometimes Gemini returns empty candidates — treat as retryable.
        lastError = new Error("Gemini returned no content");
        if (attempt < MAX_RETRIES - 1) {
          logger.warn(`Gemini empty response (attempt ${attempt + 1}/${MAX_RETRIES}) — retrying…`);
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }

      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        logger.warn(`Gemini call failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${lastError.message} — retrying…`);
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error("Gemini call failed after all retries");
}

/** What the orchestrator gets back after a turn. */
export interface AgentResult {
  reply: string;
  handoff?: ToolContext["handoff"];
  proposal?: ToolContext["proposal"];
}

/**
 * Run one user message through the agent: replays history, lets Gemini call
 * tools until it produces a text reply, persists history, returns the reply.
 */
export async function runAgentTurn(session: Session, userText: string): Promise<AgentResult> {
  const ctx: ToolContext = { session };

  // Build contents from stored history (TEXT-ONLY — we never persist tool turns,
  // and we defensively strip any non-text parts so the request can never violate
  // Gemini's "functionResponse must follow functionCall" rule) + the new message.
  const contents: Content[] = session.history
    .map((t) => ({
      role: t.role,
      parts: (t.parts as Part[]).filter((p) => typeof p.text === "string" && p.text.length > 0),
    }))
    .filter((c) => c.parts.length > 0);
  contents.push({ role: "user", parts: [{ text: userText }] });

  const MAX_TOOL_ROUNDS = 6;
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const systemPrompt = buildSystemPrompt(session.language);
    const modelContent = await callGeminiWithRetry(contents, systemPrompt);
    contents.push(modelContent);

    const calls = modelContent.parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      finalText = modelContent.parts.map((p) => p.text ?? "").join("").trim();
      break;
    }

    // Execute each tool call and feed results back.
    const responseParts: Part[] = [];
    for (const c of calls) {
      const fc = c.functionCall!;
      let result: Record<string, unknown>;
      try {
        result = await executeTool(fc.name, fc.args ?? {}, ctx);
      } catch (err) {
        logger.error(`Tool ${fc.name} failed`, err);
        result = { error: "Tool execution failed. Please try a different approach." };
      }
      responseParts.push({ functionResponse: { name: fc.name, response: result } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  if (!finalText) finalText = "Sorry, could you please rephrase that?";

  // Persist ONLY the user text and the final model text — never the intermediate
  // functionCall/functionResponse turns. This makes saved history impossible to
  // poison (the earlier cause of permanent "technical issue" errors).
  session.history.push({ role: "user", parts: [{ text: userText }] });
  session.history.push({ role: "model", parts: [{ text: finalText }] });
  session.greeted = true;
  sessions.save(session);

  return { reply: finalText, handoff: ctx.handoff, proposal: ctx.proposal };
}
