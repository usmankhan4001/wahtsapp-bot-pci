# Deploying the PCI WhatsApp Bot on Dokploy

This stack has two services — **waha** (WhatsApp gateway) and **bot** (AI sales agent).
They run together in one Docker Compose project; WAHA delivers incoming messages to
the bot over the internal network, and the bot replies + sends proposal PDFs.

## Prerequisites
- A Dokploy server (VPS) up and running.
- A dedicated **2nd WhatsApp number** for the bot (a phone that can scan a QR once).
- Your **Gemini API key**.
- The bot code in a **Git repository** (GitHub/GitLab) that Dokploy can pull,
  OR upload it as a "Docker Compose" raw stack.

## 1. Push the code to Git
From `E:\Apps\PCI Whatsapp Bot\bot`:
```bash
git init && git add . && git commit -m "PCI WhatsApp bot"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
(`.env`, `node_modules`, `dist`, `data` are git-ignored — secrets stay out of Git.)

## 2. Create the app in Dokploy
1. **Project → Create Service → Compose**.
2. Source: your Git repo (branch `main`); Compose path: `docker-compose.yml`.
3. **Environment** — add these variables (Dokploy injects them into the compose):

| Variable | Value |
|---|---|
| `WEBHOOK_TOKEN` | a long random string |
| `WAHA_API_KEY` | a long random string |
| `GEMINI_API_KEY` | your Gemini key |
| `GEMINI_MODEL` | `gemini-2.0-flash` (or a 2.5 model) |
| `BITRIX_API_BASE` | `https://calcenchancev2.premierchoiceint.online` |
| `SALES_MANAGER_WHATSAPP` | `923097772379` |
| `TEAM_B2B_WHATSAPP` | `923114882634` |
| `TEAM_B2C_WHATSAPP` | `923097772379` |
| `TEAM_CARE_WHATSAPP` | `923097772379` |

4. **Deploy.** Dokploy builds the bot image (Dockerfile uses Debian + Chromium for Puppeteer).

## 3. Authenticate WhatsApp (one-time QR)
The `waha` service exposes port `3001` for its dashboard.
- In Dokploy, add a **Domain** to the `waha` service → container port `3000`
  (e.g. `waha.yourdomain.com`), and enable **Basic Auth** so it isn't public.
- Open that URL, start the `default` session, and **scan the QR with the 2nd number**.
- WAHA persists the session in the `waha-sessions` volume — you only scan once.

## 4. Test live
- Message the 2nd number from any phone.
- Expected: the bot greets and asks language (English / Urdu / Roman Urdu),
  qualifies you, pulls live units from Bitrix, and on request sends a proposal PDF.
- The sales manager number receives a "new lead engaged" and a "proposal sent" ping.

## Notes & troubleshooting
- **Webhook**: WAHA posts to `http://bot:8090/webhook/waha?token=$WEBHOOK_TOKEN`
  internally — no public URL needed for the bot. Keep `WEBHOOK_TOKEN` matching.
- **Logs**: check the `bot` service logs in Dokploy for `Inbound from …` lines.
- **Puppeteer**: the image installs system Chromium at `/usr/bin/chromium`; the bot
  uses it via `PUPPETEER_EXECUTABLE_PATH` (set in the Dockerfile).
- **Switching to WABA later**: replace the WAHA adapter with a WABA Cloud API adapter;
  the bot core, AI, Bitrix, and PDF stay unchanged. The number must then leave WAHA.
- **Gating**: the bot auto-engages every inbound chat (intended for a dedicated number).
  Handed-off chats go silent; a lead can send `stop` to opt out.
```
