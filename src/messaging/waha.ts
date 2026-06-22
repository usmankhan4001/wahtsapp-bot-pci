// WAHA implementation of MessagingAdapter — with human-mimicking behavior.
// Docs: https://waha.devlike.pro/  (REST API: /api/sendText, /api/sendFile)
import { config } from "../config.js";
import { logger } from "../logger.js";
import type {
  IncomingMessage,
  MessagingAdapter,
  OutgoingDocument,
} from "./adapter.js";

const digitsOnly = (s: string) => String(s || "").replace(/[^\d]/g, "");

/**
 * Convert a bare phone number to a WAHA chatId. If it's already a JID of ANY
 * kind (@c.us, @g.us, @lid, @s.whatsapp.net), pass it through UNCHANGED — never
 * rewrite a @lid into @c.us (that caused "No LID for user" on reply).
 */
export function toChatId(numberOrChatId: string): string {
  if (numberOrChatId.includes("@")) return numberOrChatId;
  return `${digitsOnly(numberOrChatId)}@c.us`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.waha.apiKey) h["X-Api-Key"] = config.waha.apiKey;
  return h;
}

// ── Human-like delay configuration ──────────────────────────────
const TYPING_SPEED_MS_PER_CHAR = 35;   // ~35ms per character ≈ realistic typing
const MIN_TYPING_DELAY_MS = 800;        // minimum delay even for short messages
const MAX_TYPING_DELAY_MS = 4000;       // cap so users don't wait too long
const PAUSE_BETWEEN_MESSAGES_MS = 1200; // pause between split messages
const MAX_SINGLE_MESSAGE_LENGTH = 800;  // split messages longer than this

/** Calculate a human-like typing delay based on message length. */
function typingDelay(text: string): number {
  const raw = text.length * TYPING_SPEED_MS_PER_CHAR;
  return Math.max(MIN_TYPING_DELAY_MS, Math.min(MAX_TYPING_DELAY_MS, raw));
}

/**
 * Split a long message into natural chunks at paragraph boundaries.
 * Returns an array of message segments, each under MAX_SINGLE_MESSAGE_LENGTH.
 */
function splitMessage(text: string): string[] {
  if (text.length <= MAX_SINGLE_MESSAGE_LENGTH) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current && (current.length + para.length + 2) > MAX_SINGLE_MESSAGE_LENGTH) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If we still have chunks that are too long, split at sentence boundaries.
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= MAX_SINGLE_MESSAGE_LENGTH) {
      result.push(chunk);
    } else {
      // Split at sentence endings (. ! ?) followed by a space
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let segment = "";
      for (const sentence of sentences) {
        if (segment && (segment.length + sentence.length + 1) > MAX_SINGLE_MESSAGE_LENGTH) {
          result.push(segment.trim());
          segment = sentence;
        } else {
          segment = segment ? `${segment} ${sentence}` : sentence;
        }
      }
      if (segment.trim()) result.push(segment.trim());
    }
  }

  return result.length > 0 ? result : [text];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class WahaAdapter implements MessagingAdapter {
  /** Current status of the default session, or null if WAHA unreachable. */
  async getSessionStatus(): Promise<string | null> {
    try {
      const res = await fetch(
        `${config.waha.baseUrl}/api/sessions/${config.waha.session}`,
        { headers: headers() },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data?.status ?? null;
    } catch {
      return null;
    }
  }

  /** Start the default session (idempotent; ignores "already started"). */
  async startSession(): Promise<void> {
    try {
      await fetch(
        `${config.waha.baseUrl}/api/sessions/${config.waha.session}/start`,
        { method: "POST", headers: headers() },
      );
    } catch (err) {
      logger.error("WAHA startSession failed", err);
    }
  }

  /**
   * Wait for WAHA to be reachable, then make sure the session is running.
   * Retries because WAHA may boot slower than the bot. Logs clear guidance.
   */
  async ensureSession(retries = 12): Promise<void> {
    for (let i = 0; i < retries; i++) {
      const status = await this.getSessionStatus();
      if (status === null) {
        logger.warn(`WAHA not reachable yet (try ${i + 1}/${retries})…`);
      } else if (status === "WORKING") {
        logger.info("WAHA session WORKING — ready to chat. ✅");
        return;
      } else if (status === "STOPPED" || status === "FAILED") {
        logger.info(`WAHA session ${status} — starting it…`);
        await this.startSession();
      } else if (status === "SCAN_QR_CODE") {
        logger.warn(
          "WAHA session needs a QR scan. Open the WAHA dashboard and scan with the bot number.",
        );
        return;
      } else {
        logger.info(`WAHA session status: ${status} (waiting)…`);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    logger.warn("Gave up auto-starting the WAHA session; check the dashboard.");
  }

  // ── Core send methods ──────────────────────────────────────────

  async sendText(chatId: string, text: string): Promise<void> {
    const res = await fetch(`${config.waha.baseUrl}/api/sendText`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        session: config.waha.session,
        chatId: toChatId(chatId),
        text,
      }),
    });
    if (!res.ok) {
      logger.error("WAHA sendText failed", res.status, (await res.text()).slice(0, 300));
    }
  }

  async sendDocument(chatId: string, doc: OutgoingDocument): Promise<void> {
    const res = await fetch(`${config.waha.baseUrl}/api/sendFile`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        session: config.waha.session,
        chatId: toChatId(chatId),
        file: {
          mimetype: doc.mimetype ?? "application/pdf",
          filename: doc.filename,
          data: doc.data.toString("base64"),
        },
        caption: doc.caption,
      }),
    });
    if (!res.ok) {
      logger.error("WAHA sendFile failed", res.status, (await res.text()).slice(0, 300));
    }
  }

  /** Send a document or image by public URL (WAHA fetches it). */
  async sendByUrl(
    chatId: string,
    media: { kind: "document" | "image"; url: string; filename?: string; caption?: string },
  ): Promise<void> {
    const endpoint = media.kind === "image" ? "/api/sendImage" : "/api/sendFile";
    const res = await fetch(`${config.waha.baseUrl}${endpoint}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        session: config.waha.session,
        chatId: toChatId(chatId),
        file: { url: media.url, filename: media.filename },
        caption: media.caption,
      }),
    });
    if (!res.ok) {
      logger.error(`WAHA ${endpoint} failed`, res.status, (await res.text()).slice(0, 200));
    }
  }

  // ── Human-mimicking methods ────────────────────────────────────

  async startTyping(chatId: string): Promise<void> {
    try {
      await fetch(`${config.waha.baseUrl}/api/startTyping`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          session: config.waha.session,
          chatId: toChatId(chatId),
        }),
      });
    } catch {
      // Non-fatal — if typing indicator fails, we still send the message.
    }
  }

  async stopTyping(chatId: string): Promise<void> {
    try {
      await fetch(`${config.waha.baseUrl}/api/stopTyping`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          session: config.waha.session,
          chatId: toChatId(chatId),
        }),
      });
    } catch {
      // Non-fatal.
    }
  }

  /**
   * Send a message with full human-like behavior:
   *  1. Split long text into multiple messages
   *  2. For each segment: show typing → wait → stop typing → send
   */
  async sendTextHumanized(chatId: string, text: string): Promise<void> {
    const segments = splitMessage(text);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Show "typing…" indicator
      await this.startTyping(chatId);

      // Wait a natural amount of time
      const delay = typingDelay(segment);
      await sleep(delay);

      // Stop typing and send
      await this.stopTyping(chatId);
      await this.sendText(chatId, segment);

      // If there are more segments, pause briefly between them
      if (i < segments.length - 1) {
        await sleep(PAUSE_BETWEEN_MESSAGES_MS);
      }
    }
  }

  // ── Webhook parsing ────────────────────────────────────────────

  // WAHA posts events as { event: "message", session, payload: {...} }.
  parseWebhook(body: unknown): IncomingMessage | null {
    const b = body as any;
    if (!b || b.event !== "message" || !b.payload) return null;
    const p = b.payload;

    const chatId: string = p.from ?? "";
    const isGroup = chatId.endsWith("@g.us");
    const fromMe = Boolean(p.fromMe);

    // Only handle inbound, non-group messages with actual text.
    if (fromMe || isGroup) return null;
    const text: string = (p.body ?? "").trim();
    if (!text) return null; // ignore notifications / media-only / empty events

    return {
      chatId,
      from: digitsOnly(chatId),
      text,
      name: p._data?.notifyName ?? p.notifyName ?? undefined,
      messageId: p.id ?? "",
      timestamp: Number(p.timestamp ?? Math.floor(Date.now() / 1000)),
      fromMe,
      isGroup,
    };
  }
}
