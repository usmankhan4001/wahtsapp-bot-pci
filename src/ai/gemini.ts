// Gemini REST client with a function-calling loop.
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

async function callGemini(contents: Content[], systemPrompt: string): Promise<Content> {
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
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const data = (await res.json()) as any;
  const content = data?.candidates?.[0]?.content as Content | undefined;
  if (!content) throw new Error("Gemini returned no content");
  return content;
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

  // Build contents from stored history + the new user message.
  const contents: Content[] = session.history.map((t) => ({
    role: t.role,
    parts: t.parts as Part[],
  }));
  contents.push({ role: "user", parts: [{ text: userText }] });

  const MAX_TOOL_ROUNDS = 6;
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const systemPrompt = buildSystemPrompt(session.language);
    const modelContent = await callGemini(contents, systemPrompt);
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
        result = { error: "Tool execution failed." };
      }
      responseParts.push({ functionResponse: { name: fc.name, response: result } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  if (!finalText) finalText = "Sorry, could you please rephrase that?";

  // Persist the new turns (everything after the replayed history).
  const newTurns: Turn[] = contents
    .slice(session.history.length)
    .map((c) => ({ role: c.role, parts: c.parts }));
  session.history.push(...newTurns);
  session.greeted = true;
  sessions.save(session);

  return { reply: finalText, handoff: ctx.handoff, proposal: ctx.proposal };
}
