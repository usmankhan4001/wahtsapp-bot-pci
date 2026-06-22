// WAHA implementation of MessagingAdapter.
// Docs: https://waha.devlike.pro/  (REST API: /api/sendText, /api/sendFile)
import { config } from "../config.js";
import { logger } from "../logger.js";
import type {
  IncomingMessage,
  MessagingAdapter,
  OutgoingDocument,
} from "./adapter.js";

const digitsOnly = (s: string) => String(s || "").replace(/[^\d]/g, "");

/** Convert a bare phone number to a WAHA chatId; pass through if already `@c.us`/`@g.us`. */
export function toChatId(numberOrChatId: string): string {
  if (/@(c|g)\.us$/.test(numberOrChatId)) return numberOrChatId;
  return `${digitsOnly(numberOrChatId)}@c.us`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.waha.apiKey) h["X-Api-Key"] = config.waha.apiKey;
  return h;
}

export class WahaAdapter implements MessagingAdapter {
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

  // WAHA posts events as { event: "message", session, payload: {...} }.
  parseWebhook(body: unknown): IncomingMessage | null {
    const b = body as any;
    if (!b || b.event !== "message" || !b.payload) return null;
    const p = b.payload;

    const chatId: string = p.from ?? "";
    const isGroup = chatId.endsWith("@g.us");
    const fromMe = Boolean(p.fromMe);

    // Only handle inbound, non-group, text messages in Phase 1.
    if (fromMe || isGroup) return null;
    const text: string = p.body ?? "";

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
