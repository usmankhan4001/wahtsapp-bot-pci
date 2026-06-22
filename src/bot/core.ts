// Bot orchestrator: ties together session, Gemini agent, and messaging.
// Uses humanized messaging (typing indicators + natural delays) for all replies.
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { MessagingAdapter, IncomingMessage } from "../messaging/adapter.js";
import { sessions } from "../session/store.js";
import { runAgentTurn } from "../ai/gemini.js";
import type { HandoffSignal, ProposalSignal, MediaItem } from "../ai/tools.js";
import { generateProposal } from "../proposal/index.js";
import { brochureUrl } from "../media/registry.js";

const TEAM_NUMBER: Record<HandoffSignal["team"], string> = {
  B2B: config.contacts.teamB2B,
  B2C: config.contacts.teamB2C,
  CARE: config.contacts.teamCare || config.contacts.salesManager,
};

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

    // Per-chat serialisation — prevent concurrent turns on the same session.
    const prev = this.locks.get(msg.chatId) ?? Promise.resolve();
    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    this.locks.set(msg.chatId, promise);
    try {
      await prev; // wait for any in-flight turn to finish

      const session = sessions.get(msg.chatId, msg.name);

      // A chat handed to a human stays silent until manually resumed.
      if (session.status !== "active") {
        // Allow "resume" command to reactivate a handed-off or paused chat.
        if (/^\s*(resume|start|hi|hello|assalam|salam)\s*$/i.test(msg.text)) {
          session.status = "active";
          session.greeted = false; // Re-greet the lead
          session.history = [];   // Fresh start
          sessions.save(session);
          logger.info(`Chat ${msg.from} resumed from '${session.status}'.`);
          // Fall through to handle normally
        } else {
          logger.info(`Chat ${msg.from} is '${session.status}' — bot staying silent.`);
          return;
        }
      }

      // Lead opt-out.
      if (/^\s*(stop|unsubscribe)\s*$/i.test(msg.text)) {
        session.status = "paused";
        sessions.save(session);
        await this.messaging.sendTextHumanized(
          msg.chatId,
          "Okay, I won't message further. Reply anytime to resume. 🙏",
        );
        return;
      }

      // Show typing immediately so the user knows the bot is working.
      await this.messaging.startTyping(msg.chatId);

      // Notify sales manager the first time the bot engages a new lead.
      const firstContact = !session.greeted;

      let result;
      try {
        result = await runAgentTurn(session, msg.text);
      } catch (err) {
        logger.error("Agent turn failed", err);
        await this.messaging.stopTyping(msg.chatId);
        await this.messaging.sendTextHumanized(
          msg.chatId,
          "Apologies — I'm having a brief technical issue. A team member will assist you shortly. 🙏",
        );
        return;
      }

      // Stop the initial typing indicator (sendTextHumanized will create its own).
      await this.messaging.stopTyping(msg.chatId);

      // Send the reply with human-like typing delay.
      await this.messaging.sendTextHumanized(msg.chatId, result.reply);

      // Send any requested media (brochures / floor plans / location).
      if (result.media?.length) await this.sendMedia(msg, result.media);

      // Post-reply actions (run in background — don't delay the user).
      if (firstContact) {
        this.notifyManagerLeadEngaged(msg).catch((e) =>
          logger.error("Manager notification failed", e),
        );
      }
      if (result.proposal) {
        // Show typing while generating the PDF.
        await this.messaging.startTyping(msg.chatId);
        await this.sendProposal(msg, result.proposal);
      }
      if (result.handoff) {
        await this.doHandoff(msg, result.handoff);
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

  private async sendProposal(msg: IncomingMessage, p: ProposalSignal): Promise<void> {
    try {
      const out = await generateProposal({ ...p, clientName: msg.name });
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
        caption: "Here is your Premier Choice International payment proposal. 📄",
      });

      // Auto-attach the project brochure alongside the proposal, if available.
      const bUrl = brochureUrl(out.projectName ?? "");
      if (bUrl) {
        await this.messaging
          .sendByUrl(msg.chatId, {
            kind: "document",
            url: bUrl,
            filename: `${out.projectName ?? "Project"} Brochure.pdf`,
            caption: "📄 Project brochure for your reference.",
          })
          .catch((e) => logger.error("Brochure attach failed", e));
      }

      // Notify the sales manager that a proposal was sent.
      if (config.contacts.salesManager) {
        this.messaging.sendText(
          config.contacts.salesManager,
          `📄 *PCI Bot* — proposal sent.\nLead: ${msg.name ?? "Unknown"} (+${msg.from})\n${out.summary}`,
        ).catch((e) => logger.error("Manager proposal notification failed", e));
      }
    } catch (err) {
      logger.error("Proposal generation/send failed", err);
      await this.messaging.stopTyping(msg.chatId);
      await this.messaging.sendTextHumanized(
        msg.chatId,
        "Apologies — I had trouble generating the proposal. A team member will follow up shortly. 🙏",
      );
    }
  }

  private async doHandoff(msg: IncomingMessage, h: HandoffSignal): Promise<void> {
    const session = sessions.get(msg.chatId);
    session.status = "handed_off";
    sessions.save(session);

    const target = TEAM_NUMBER[h.team];
    const summary =
      `🤝 *PCI Bot — ${h.team} handoff*\n` +
      `Lead: ${msg.name ?? "Unknown"} (+${msg.from})\n` +
      `Reason: ${h.reason}`;

    if (target) {
      this.messaging.sendText(target, summary).catch((e) =>
        logger.error(`Handoff notification to ${h.team} failed`, e),
      );
    } else {
      logger.warn(`No number configured for team ${h.team}; handoff not delivered.`);
    }

    // Also inform the sales manager that a lead moved to a team.
    if (config.contacts.salesManager && config.contacts.salesManager !== target) {
      this.messaging.sendText(config.contacts.salesManager, summary).catch((e) =>
        logger.error("Manager handoff notification failed", e),
      );
    }
  }

  private async notifyManagerLeadEngaged(msg: IncomingMessage): Promise<void> {
    if (!config.contacts.salesManager) return;
    await this.messaging.sendText(
      config.contacts.salesManager,
      `🟢 *PCI Bot* — new lead engaged.\nName: ${msg.name ?? "Unknown"}\nNumber: +${msg.from}`,
    );
  }
}
