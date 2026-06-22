// Per-chat conversation state. In-memory with lazy JSON persistence so the bot
// survives restarts without a database. Swap for SQLite/Redis later if needed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type Language = "english" | "urdu" | "roman_urdu";
export type ChatStatus = "active" | "paused" | "handed_off";

/** One turn of conversation in Gemini's content format. */
export interface Turn {
  role: "user" | "model";
  // We store parts as-is (text / functionCall / functionResponse) for replay.
  parts: unknown[];
}

export interface Session {
  chatId: string;
  name?: string;
  language?: Language;
  status: ChatStatus;
  /** Set true once we've greeted + asked language, so we don't repeat it. */
  greeted: boolean;
  history: Turn[];
  createdAt: number;
  updatedAt: number;
}

const DATA_FILE = "data/sessions.json";
const MAX_HISTORY = 40; // keep last N turns to bound token usage

// After this much inactivity, treat the next message as a NEW conversation:
// reset history/language/greeting so the bot greets fresh (per-chat "new bot").
const RESET_MS =
  (Number(String(process.env.CONVERSATION_RESET_MINUTES ?? "").trim()) || 60) * 60 * 1000;

/** Keep only valid text turns — strips any functionCall/functionResponse parts
 *  (defends against older poisoned sessions on disk). */
function sanitizeHistory(h: unknown): Turn[] {
  if (!Array.isArray(h)) return [];
  return (h as Turn[])
    .map((t) => ({
      role: t?.role,
      parts: (Array.isArray(t?.parts) ? t.parts : []).filter(
        (p: any) => p && typeof p.text === "string" && p.text.length > 0,
      ),
    }))
    .filter((t) => (t.role === "user" || t.role === "model") && t.parts.length > 0);
}

class SessionStore {
  private map = new Map<string, Session>();

  constructor() {
    this.load();
  }

  get(chatId: string, name?: string): Session {
    let s = this.map.get(chatId);

    // New conversation after a long gap → reset to a fresh bot for this chat.
    if (s && Date.now() - s.updatedAt > RESET_MS) {
      s = undefined;
    }

    if (!s) {
      s = {
        chatId,
        name,
        status: "active",
        greeted: false,
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.map.set(chatId, s);
    }
    if (name) s.name = name;
    return s;
  }

  save(s: Session): void {
    s.updatedAt = Date.now();
    if (s.history.length > MAX_HISTORY) {
      s.history = s.history.slice(-MAX_HISTORY);
    }
    this.map.set(s.chatId, s);
    this.persist();
  }

  private load(): void {
    try {
      if (existsSync(DATA_FILE)) {
        const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Session[];
        for (const s of raw) {
          s.history = sanitizeHistory(s.history); // clean any old poisoned turns
          this.map.set(s.chatId, s);
        }
      }
    } catch {
      /* start fresh on corrupt file */
    }
  }

  private persist(): void {
    try {
      mkdirSync(dirname(DATA_FILE), { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify([...this.map.values()], null, 0));
    } catch {
      /* non-fatal */
    }
  }
}

export const sessions = new SessionStore();
