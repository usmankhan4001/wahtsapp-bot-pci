// Bot orchestrator: ties together session, Gemini agent, and messaging.
// Uses humanized messaging (typing indicators + natural delays) for all replies.
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { MessagingAdapter, IncomingMessage } from "../messaging/adapter.js";
import { sessions } from "../session/store.js";
import { runAgentTurn } from "../ai/gemini.js";
import type { MediaItem } from "../ai/tools.js";

export class BotCore {
  // Recently handled message ids — WAHA sometimes delivers a webhook twice.
  private seen = new Set<string>();

  // Per-chat mutex — prevents concurrent agent turns on the same session.
  private locks = new Map<string, Promise<void>>();

  constructor(private messaging: MessagingAdapter) {}

  async handle(msg: IncomingMessage): Promise<void> {
    // Drop duplicate webhook deliveries of the same message.
    if (msg.messageId) {
      if (this.seen.has(msg.messageId)) {
        logger.info(`Duplicate message ${msg.messageId} ignored.`);
        return;
      }
      this.seen.add(msg.messageId);
      if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value as string);
    }

    // Check if user is an authorized sales rep
    let isAdmin = false;
    if (config.adminNumbers.includes(msg.from)) {
      isAdmin = true;
    } else if (!config.standardNumbers.includes(msg.from)) {
      logger.warn(`Unauthorized access attempt from ${msg.from}`);
      return;
    }

    // Per-chat serialisation — prevent concurrent turns on the same session.
    const prev = this.locks.get(msg.chatId) ?? Promise.resolve();
    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    this.locks.set(msg.chatId, promise);
    try {
      await prev; // wait for any in-flight turn to finish

      const session = sessions.get(msg.chatId, msg.name);
      session.isAdmin = isAdmin;

      // Show typing immediately so the user knows the bot is working.
      await this.messaging.startTyping(msg.chatId);

      let result;
      try {
        result = await runAgentTurn(session, msg.text);
      } catch (err) {
        logger.error("Agent turn failed", err);
        await this.messaging.stopTyping(msg.chatId);
        await this.messaging.sendTextHumanized(
          msg.chatId,
          "Apologies — I'm having a brief technical issue fetching the data. Please try again.",
        );
        return;
      }

      // Stop the initial typing indicator
      await this.messaging.stopTyping(msg.chatId);

      // Send the reply with human-like typing delay.
      await this.messaging.sendTextHumanized(msg.chatId, result.reply);

      // Send any requested media (brochures / floor plans).
      if (result.media?.length) {
        await this.sendMedia(msg, result.media);
      }

      if (result.proposal) {
        // Show typing while generating the PDF.
        await this.messaging.startTyping(msg.chatId);
        await this.sendProposal(msg, result.proposal);
      }
    } finally {
      resolve();
      // Clean up if nothing else is queued
      if (this.locks.get(msg.chatId) === promise) this.locks.delete(msg.chatId);
    }
  }

  private async sendMedia(msg: IncomingMessage, items: MediaItem[]): Promise<void> {
    for (const m of items) {
      try {
        if (m.kind === "text") {
          if (m.caption) await this.messaging.sendText(msg.chatId, m.caption);
        } else if (m.url) {
          await this.messaging.sendByUrl(msg.chatId, {
            kind: m.kind,
            url: m.url,
            filename: m.filename,
            caption: m.caption,
          });
        }
      } catch (e) {
        logger.error("Media send failed", e);
      }
    }
  }

  private async sendProposal(msg: IncomingMessage, p: any): Promise<void> {
    try {
      const { generateProposal } = await import("../proposal/index.js");
      const out = await generateProposal(p);
      if (!out) {
        await this.messaging.stopTyping(msg.chatId);
        await this.messaging.sendTextHumanized(
          msg.chatId,
          "Sorry, I couldn't find that unit to prepare a proposal. Could you confirm the unit number?",
        );
        return;
      }

      await this.messaging.stopTyping(msg.chatId);
      await this.messaging.sendDocument(msg.chatId, {
        data: out.pdf,
        filename: out.filename,
        mimetype: "application/pdf",
        caption: `Here is the payment proposal for ${out.unitName}. 📄`,
      });
    } catch (err) {
      logger.error("Proposal generation/send failed", err);
      await this.messaging.stopTyping(msg.chatId);
      await this.messaging.sendTextHumanized(
        msg.chatId,
        "Apologies — I had trouble generating the proposal.",
      );
    }
  }
}
