// PCI WhatsApp Bot — entry point for internal sales V1.5
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WahaAdapter } from "./messaging/waha.js";
import type { IncomingMessage } from "./messaging/adapter.js";
import { BotCore } from "./bot/core.js";
import { fetchInventory } from "./inventory/loader.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const messaging = new WahaAdapter();
const bot = new BotCore(messaging);

const BUILD = "2026-06-30-v1.5-sales-internal";

// ── Health check ───────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, service: "pci-whatsapp-bot-v1.5", build: BUILD }));
app.get("/version", (_req, res) => res.json({ build: BUILD, model: config.gemini.model }));

// ── Debug routes for Sheets ───
app.use("/debug", (req, res, next) => {
  if (config.webhookToken && req.query.token !== config.webhookToken) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

app.get("/debug/inventory", async (req, res) => {
  try {
    const units = await fetchInventory();
    res.json({ count: units.length, sample: units.slice(0, 5) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── WAHA webhook ───────────────────────────────────────────────
app.post("/webhook/waha", async (req, res) => {
  if (config.webhookToken && req.query.token !== config.webhookToken) {
    logger.warn("Rejected webhook with bad/missing token");
    return res.status(401).json({ error: "unauthorized" });
  }

  res.json({ ok: true });

  try {
    const msg = messaging.parseWebhook(req.body);
    if (msg) await handleMessage(msg);
  } catch (err) {
    logger.error("Webhook processing error", err);
  }
});

async function handleMessage(msg: IncomingMessage): Promise<void> {
  logger.info(`Inbound from ${msg.from} (${msg.name ?? "?"}): ${JSON.stringify(msg.text)}`);
  await bot.handle(msg);
}

function startupDiagnostics(): void {
  const ok = (b: boolean) => (b ? "✅" : "❌ MISSING");
  logger.info("── PCI WhatsApp Bot (V1.5) — startup checks ──");
  logger.info(`  WAHA base URL ........ ${config.waha.baseUrl} ${ok(!!config.waha.baseUrl)}`);
  logger.info(`  WAHA API key ......... ${ok(!!config.waha.apiKey)}`);
  logger.info(`  Webhook token ........ ${ok(!!config.webhookToken)}`);
  logger.info(`  Gemini API key ....... ${ok(!!config.gemini.apiKey)} (model: ${config.gemini.model})`);
  logger.info(`  Google Sheets URL .... ${process.env.GOOGLE_SHEETS_CSV_URL ? "✅" : "❌ MISSING"}`);
  if (!config.gemini.apiKey)
    logger.warn("GEMINI_API_KEY is not set — the bot will receive messages but cannot generate replies.");
}

// Prefetch the inventory on startup
await fetchInventory();

// Refresh inventory periodically (every 5 minutes)
setInterval(fetchInventory, 5 * 60 * 1000);

app.listen(config.port, async () => {
  logger.info(`PCI WhatsApp Bot listening on :${config.port} (build ${BUILD})`);
  startupDiagnostics();
  await messaging.ensureSession();
});

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    logger.info(`Received ${sig}, shutting down…`);
    process.exit(0);
  });
}
