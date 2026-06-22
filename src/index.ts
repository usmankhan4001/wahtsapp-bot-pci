// PCI WhatsApp Bot — entry point.
// Phase 1: HTTP server + WAHA webhook -> echo reply (proves the number is wired).
// Later phases plug the bot core (Gemini + Bitrix + proposal engine) into handleMessage().
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WahaAdapter } from "./messaging/waha.js";
import type { IncomingMessage } from "./messaging/adapter.js";
import { bitrix } from "./bitrix/client.js";
import { BotCore } from "./bot/core.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const messaging = new WahaAdapter();
const bot = new BotCore(messaging);

// ── Health check ───────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, service: "pci-whatsapp-bot" }));

// ── Bitrix debug routes (Phase 2 — verify live availability) ───
app.get("/debug/projects", async (_req, res) => {
  try {
    res.json(await bitrix.listProjects());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/debug/units", async (req, res) => {
  try {
    const filter = {
      project: req.query.project as string | undefined,
      propertyType: req.query.type as string | undefined,
      propertyFloor: req.query.floor as string | undefined,
    };
    const units = await bitrix.searchUnits(filter);
    res.json({ count: units.length, sample: units.slice(0, 5) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/debug/unit/:id", async (req, res) => {
  try {
    res.json(await bitrix.getNormalizedUnit(req.params.id));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── WAHA webhook ───────────────────────────────────────────────
// Configure WAHA to POST events here: <PUBLIC_URL>/webhook/waha?token=<WEBHOOK_TOKEN>
app.post("/webhook/waha", async (req, res) => {
  // Verify shared token so only our WAHA instance can drive the bot.
  if (config.webhookToken && req.query.token !== config.webhookToken) {
    logger.warn("Rejected webhook with bad/missing token");
    return res.status(401).json({ error: "unauthorized" });
  }

  // Ack immediately; process in the background so WAHA never blocks/retries on slow work.
  res.json({ ok: true });

  try {
    const msg = messaging.parseWebhook(req.body);
    if (msg) await handleMessage(msg);
  } catch (err) {
    logger.error("Webhook processing error", err);
  }
});

// ── Message handler → Gemini sales agent (Phase 3) ─────────────
async function handleMessage(msg: IncomingMessage): Promise<void> {
  logger.info(`Inbound from ${msg.from} (${msg.name ?? "?"}): ${JSON.stringify(msg.text)}`);
  await bot.handle(msg);
}

app.listen(config.port, () => {
  logger.info(`PCI WhatsApp Bot listening on :${config.port}`);
  logger.info(`WAHA base: ${config.waha.baseUrl} (session: ${config.waha.session})`);
  logger.info(`Webhook:  POST /webhook/waha?token=<WEBHOOK_TOKEN>`);
});
