# PCI WhatsApp Bot — Deployment Guide (Dokploy)

This is the complete, current guide. The system is **two separate Dokploy
Applications** that talk over their public HTTPS domains:

```
WhatsApp number ── WAHA app (devlikeapro/waha) ──webhook──▶ Bot app (this repo)
                       waha-pci-bot.premierchoiceint.online      ai-reply-bot.premierchoiceint.online
                                                                   │
                              Bitrix24 calculator API ◀───────────┤  (live units + prices)
                              Gemini (chat + embeddings) ◀─────────┤  (sales AI + RAG)
                              Cloudflare R2 media ◀────────────────┘  (brochures/floor plans)
```

Why two apps: a **bot redeploy never restarts WAHA**, so the scanned WhatsApp
session stays alive while you iterate.

---

## 0. Prerequisites
- Dokploy server (VPS) with a wildcard domain on Cloudflare (`*.premierchoiceint.online`).
- A dedicated **2nd WhatsApp number** (scan a QR once).
- **Gemini API key**.
- Repo on GitHub: `usmankhan4001/wahtsapp-bot-pci`.

---

## 1. WAHA app (WhatsApp gateway)

**Create → Application → Docker Image:** `devlikeapro/waha:latest`

**Volume:** mount `/app/.sessions` (persists the WhatsApp login across redeploys).

**Environment** — every value must be the literal string (NO `< >` placeholders,
NO descriptive notes in parentheses, or WAHA refuses to boot):
```
WAHA_API_KEY=Pr3m!3r3Ch0!c3@4001USMAN2026
WHATSAPP_DEFAULT_ENGINE=WEBJS
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=Pr3m!3r3Ch0!c3@4001
WHATSAPP_SWAGGER_USERNAME=admin
WHATSAPP_SWAGGER_PASSWORD=Pr3m!3r3Ch0!c3@4001
WHATSAPP_HOOK_URL=https://ai-reply-bot.premierchoiceint.online/webhook/waha?token=pci_secure_webhook_token_2026
WHATSAPP_HOOK_EVENTS=message
```
- Use the WAHA env names **`WHATSAPP_HOOK_URL` / `WHATSAPP_HOOK_EVENTS`** (not `WAHA_WEBHOOK_*`).
- The `token=` in the hook URL **must equal** the bot's `WEBHOOK_TOKEN`.

**Domain:** `waha-pci-bot.premierchoiceint.online` → **container port 3000**, HTTPS on.
Do **not** publish a host port (avoids clashes). Enable Basic Auth on the domain.

---

## 2. Bot app (this repo)

**Create → Application → GitHub:** `usmankhan4001/wahtsapp-bot-pci`, branch `main`,
**Build Type = Dockerfile** (required — the Dockerfile installs Chromium for the
pixel-match PDF; without it the bot still works via the pdfkit fallback).

**Volume:** mount `/app/data` (persists chat sessions + the RAG vector index).

**Environment:**
```
PORT=8090
WEBHOOK_TOKEN=pci_secure_webhook_token_2026
WAHA_BASE_URL=https://waha-pci-bot.premierchoiceint.online
WAHA_API_KEY=Pr3m!3r3Ch0!c3@4001USMAN2026
GEMINI_API_KEY=<your gemini key>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBED_MODEL=text-embedding-004
BITRIX_API_BASE=https://calcenchancev2.premierchoiceint.online
MEDIA_BASE_URL=https://media.premierchoiceint.online
SALES_MANAGER_WHATSAPP=923097772379
TEAM_B2B_WHATSAPP=923114882634
TEAM_B2C_WHATSAPP=923097772379
CONVERSATION_RESET_MINUTES=60
```
- Paste **only the value** — the bot now sanitizes stray notes/spaces, but keep it clean.
- `GEMINI_MODEL` must be a current model (`gemini-2.5-flash`). `gemini-2.0-flash` is retired (404).

**Domain:** `ai-reply-bot.premierchoiceint.online` → **container port 8090**, HTTPS on.
Required so WAHA's webhook can reach the bot.

---

## 3. First-time WhatsApp login (once)
1. Open `https://waha-pci-bot.premierchoiceint.online` (dashboard).
2. Server dialog → API URL = that same URL, API Key = `WAHA_API_KEY` → Save.
3. Start the session named exactly **`default`** (WAHA Core only allows `default`).
4. **Scan the QR** with the 2nd WhatsApp number → status becomes **WORKING**.
The bot auto-starts the `default` session on each boot, so you only scan once
(unless you logout or change the engine).

---

## 4. Media + RAG (brochures) — when files are ready
1. Upload brochures/floor-plans/images to R2 under per-project slugs, e.g.
   `media.premierchoiceint.online/box-park-3/brochure.pdf`.
2. Fill real paths in `src/media/registry.ts` (the `MEDIA` array).
3. Put source PDFs in `media-source/<Project Name>/` and run **`npm run ingest`**
   (locally or on the server) → writes `data/vectors.json` (the brochure index).
4. Ensure `data/vectors.json` is present in the bot's `/app/data` volume
   (commit it, or copy it into the volume), then redeploy.

---

## 5. Verify
```bash
curl https://ai-reply-bot.premierchoiceint.online/version
#   {"build":"2026-06-22-rag-media-1","model":"gemini-2.5-flash"}
curl https://ai-reply-bot.premierchoiceint.online/health
#   {"ok":true,...}
```
Check the bot logs for the startup checklist (all ✅) and `WAHA session WORKING ✅`.
Then message the number from another phone.

---

## 6. Troubleshooting (seen in the wild)
| Symptom | Cause | Fix |
|---|---|---|
| WAHA won't boot, "Invalid global webhook config" | `< >` or notes inside `WHATSAPP_HOOK_URL` | Use the literal URL only |
| Bot `Exited 1`, `ERR_SOCKET_BAD_PORT` | bad `PORT` value | Use a number or remove it (defaults 8090) |
| Domain 502 | container crashed OR domain→wrong port | Fix crash; set domain target port (3000 WAHA / 8090 bot) |
| No `Inbound …` in bot logs | webhook not reaching bot | Check `WHATSAPP_HOOK_URL` host + token match |
| Reply fails "No LID for user" | sender is a `@lid` JID | Already handled (we reply to the exact JID) |
| Gemini 404 | retired model | `GEMINI_MODEL=gemini-2.5-flash` |
| "technical issue" every msg | poisoned session history | Fixed (text-only history); clear `data/sessions.json` once |
| Proposal apology | Puppeteer/Chromium missing | pdfkit fallback now always sends; for pixel-match use Dockerfile build |
| Session 422 "only default" | non-`default` session name | Use the `default` session |

Clear a stuck session: in the bot container terminal `rm -f /app/data/sessions.json` then restart.

---

## 7. Future: WABA migration
When moving to the official number on WhatsApp Business Cloud API, only the
messaging adapter changes (the bot core, AI, RAG, Bitrix, PDF stay the same).
A number can't run WAHA and WABA at once; WABA adds the 24h window + templates.
