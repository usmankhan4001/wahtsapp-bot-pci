# PCI WhatsApp Bot

WhatsApp AI sales assistant for **Premier Choice International**. A lead messages the
bot; it chats as a professional sales executive (Urdu / Roman Urdu / English), pulls
**live unit availability** from the existing Bitrix24 calculator backend, builds a
**payment proposal PDF**, and sends it on WhatsApp — then notifies the sales manager.
It can also hand a chat off to the **B2B / B2C / Customer Care** teams.

## Architecture

```
WhatsApp (2nd number) ── WAHA (standalone, :3001) ──webhook──▶ Bot service (:8090)
                                                                  │
                         Bitrix24 calculator API ◀───────────────┤
                         Gemini (sales AI + extraction) ◀─────────┤
                         Proposal engine (calc + PDF) ◀───────────┘
```

All WhatsApp I/O goes through `src/messaging/adapter.ts`, so WAHA can be swapped for
the official **WABA Cloud API** later without touching the bot core.

## Status — Phase 1 (scaffold)
- [x] HTTP server + health check
- [x] Messaging adapter interface + WAHA adapter (send text / send document / parse webhook)
- [x] Webhook endpoint with token auth → **echo reply** (proves the number works)
- [x] Standalone WAHA via `docker-compose.yml`
- [ ] Phase 2: Bitrix availability tools
- [ ] Phase 3: Gemini conversation + language preference + structured extraction
- [ ] Phase 4: server-side payment calc + proposal PDF
- [ ] Phase 5: sales-manager notifications + team handoff + per-chat pause

## Run locally (Node)
```bash
cp .env.example .env   # fill in values
npm install
npm run dev
```

## Run with Docker (recommended — includes standalone WAHA)
```bash
cp .env.example .env   # set WEBHOOK_TOKEN, WAHA_API_KEY, etc.
docker compose up -d --build
# open http://localhost:3001  -> scan the QR with the PCI 2nd number
```
Once the session is authenticated, message the number from any phone — you should get
the Phase 1 echo reply.

## Config
See `.env.example`. Numbers/keys (sales manager, B2B/B2C/Care, Gemini) can be added
any time without code changes.
