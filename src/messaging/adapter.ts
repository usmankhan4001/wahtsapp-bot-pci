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

  // ── Human-mimicking methods ──
  /** Trigger the "typing…" indicator in the chat. */
  startTyping(chatId: string): Promise<void>;
  /** Stop the "typing…" indicator. */
  stopTyping(chatId: string): Promise<void>;
  /**
   * Send a text message with human-like behavior:
   * 1) Show "typing…" indicator
   * 2) Wait a natural delay based on message length
   * 3) Send the message
   * If the text is long, it may be split into multiple shorter messages
   * with brief pauses between them.
   */
  sendTextHumanized(chatId: string, text: string): Promise<void>;
}
