// Bot orchestrator: ties together session, Gemini agent, and messaging.
// Notifications + team routing are stubbed here and completed in Phase 5.
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
      logger.info(`Chat ${msg.from} is '${session.status}' — bot staying silent.`);
      return;
    }

    // Lead opt-out.
    if (/^\s*(stop|unsubscribe)\s*$/i.test(msg.text)) {
      session.status = "paused";
      sessions.save(session);
      await this.messaging.sendText(msg.chatId, "Okay, I won't message further. Reply anytime to resume. 🙏");
      return;
    }

    // Notify sales manager the first time the bot engages a new lead. (Phase 5)
    const firstContact = !session.greeted;

    let result;
    try {
      result = await runAgentTurn(session, msg.text);
    } catch (err) {
      logger.error("Agent turn failed", err);
      await this.messaging.sendText(
        msg.chatId,
        "Apologies — I'm having a brief technical issue. A team member will assist you shortly.",
      );
      return;
    }

    await this.messaging.sendText(msg.chatId, result.reply);

    if (firstContact) await this.notifyManagerLeadEngaged(msg);
    if (result.proposal) await this.sendProposal(msg, result.proposal);
    if (result.handoff) await this.doHandoff(msg, result.handoff);
  }

  private async sendProposal(msg: IncomingMessage, p: ProposalSignal): Promise<void> {
    try {
      const out = await generateProposal({ ...p, clientName: msg.name });
      if (!out) {
        await this.messaging.sendText(msg.chatId, "Sorry, I couldn't find that unit to prepare a proposal.");
        return;
      }
      await this.messaging.sendDocument(msg.chatId, {
        data: out.pdf,
        filename: out.filename,
        mimetype: "application/pdf",
        caption: "Here is your Premier Choice International payment proposal. 📄",
      });

      // Notify the sales manager that a proposal was sent.
      if (config.contacts.salesManager) {
        await this.messaging.sendText(
          config.contacts.salesManager,
          `📄 *PCI Bot* — proposal sent.\nLead: ${msg.name ?? "Unknown"} (+${msg.from})\n${out.summary}`,
        );
      }
    } catch (err) {
      logger.error("Proposal generation/send failed", err);
      await this.messaging.sendText(
        msg.chatId,
        "Apologies — I had trouble generating the proposal. A team member will follow up shortly.",
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

    if (target) await this.messaging.sendText(target, summary);
    else logger.warn(`No number configured for team ${h.team}; handoff not delivered.`);

    // Also inform the sales manager that a proposal-stage lead moved to a team.
    if (config.contacts.salesManager && config.contacts.salesManager !== target) {
      await this.messaging.sendText(config.contacts.salesManager, summary);
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
