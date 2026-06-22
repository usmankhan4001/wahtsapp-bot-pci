// Bot orchestrator: ties together session, Gemini agent, and messaging.
// Uses humanized messaging (typing indicators + natural delays) for all replies.
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { MessagingAdapter, IncomingMessage } from "../messaging/adapter.js";
import { sessions } from "../session/store.js";
import { runAgentTurn } from "../ai/gemini.js";
import type { HandoffSignal, ProposalSignal } from "../ai/tools.js";
import { generateProposal } from "../proposal/index.js";

const TEAM_NUMBER: Record<HandoffSignal["team"], string> = {
  B2B: config.contacts.teamB2B,
  B2C: config.contacts.teamB2C,
  CARE: config.contacts.teamCare || config.contacts.salesManager,
};

export class BotCore {
  constructor(private messaging: MessagingAdapter) {}

  async handle(msg: IncomingMessage): Promise<void> {
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
