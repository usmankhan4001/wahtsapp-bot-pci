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
