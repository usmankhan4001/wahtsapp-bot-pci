// ── Messaging abstraction ────────────────────────────────────────
// The whole bot talks to WhatsApp ONLY through this interface, so the
// transport (WAHA today, WABA Cloud API later) can be swapped without
// touching the bot core, AI, calculator, or notification logic.

export interface IncomingMessage {
  /** Provider chat id, e.g. WAHA `<number>@c.us`. Use for replies. */
  chatId: string;
  /** Sender's phone number, digits only (country code, no +). */
  from: string;
  /** Plain-text body of the message (empty for media-only messages). */
  text: string;
  /** WhatsApp profile/push name, if provided. */
  name?: string;
  /** Provider message id. */
  messageId: string;
  /** Unix seconds. */
  timestamp: number;
  /** True if we sent it (echoes of our own outbound). Ignore these. */
  fromMe: boolean;
  /** True for group chats — the bot ignores groups. */
  isGroup: boolean;
}

export interface OutgoingDocument {
  data: Buffer;
  filename: string;
  mimetype?: string;
  caption?: string;
}

export interface MessagingAdapter {
  /** Send a plain text message to a chat. */
  sendText(chatId: string, text: string): Promise<void>;
  /** Send a document (e.g. the proposal PDF) to a chat. */
  sendDocument(chatId: string, doc: OutgoingDocument): Promise<void>;
  /** Normalize a raw provider webhook body into IncomingMessage, or null if not a user text message we should handle. */
  parseWebhook(body: unknown): IncomingMessage | null;
}
