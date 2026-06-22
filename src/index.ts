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

// Build marker — bump on each deploy so we can confirm what's actually running.
const BUILD = "2026-06-22-stability-1";

// ── Health check ───────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, service: "pci-whatsapp-bot", build: BUILD }));
app.get("/version", (_req, res) => res.json({ build: BUILD, model: config.gemini.model }));

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

function startupDiagnostics(): void {
  const ok = (b: boolean) => (b ? "✅" : "❌ MISSING");
  logger.info("── PCI WhatsApp Bot — startup checks ──");
  logger.info(`  WAHA base URL ........ ${config.waha.baseUrl} ${ok(!!config.waha.baseUrl)}`);
  logger.info(`  WAHA API key ......... ${ok(!!config.waha.apiKey)}`);
  logger.info(`  Webhook token ........ ${ok(!!config.webhookToken)}`);
  logger.info(`  Gemini API key ....... ${ok(!!config.gemini.apiKey)} (model: ${config.gemini.model})`);
  logger.info(`  Bitrix API base ...... ${config.bitrixApiBase || "❌ MISSING"}`);
  logger.info(`  Sales manager # ...... ${config.contacts.salesManager || "(unset)"}`);
  if (!config.gemini.apiKey)
    logger.warn("GEMINI_API_KEY is not set — the bot will receive messages but cannot generate replies. Set it in the env and redeploy.");
  if (!config.webhookToken)
    logger.warn("WEBHOOK_TOKEN is not set — webhook auth is effectively open.");
}

app.listen(config.port, async () => {
  logger.info(`PCI WhatsApp Bot listening on :${config.port} (build ${BUILD})`);
  startupDiagnostics();
  // Auto-start the WhatsApp session so a redeploy doesn't require manual clicks.
  await messaging.ensureSession();
});
