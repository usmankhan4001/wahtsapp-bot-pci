// Centralized, typed access to environment configuration.
// Loaded once at startup; everything else imports `config`.

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Parse a port from env; fall back to `fallback` if missing/invalid (avoids NaN crash). */
function parsePort(raw: string | undefined, fallback: number): number {
  const p = Number(String(raw ?? "").trim());
  return Number.isInteger(p) && p > 0 && p < 65536 ? p : fallback;
}

/**
 * Sanitize a URL env value: trim, take only the first whitespace-delimited token
 * (drops accidentally-pasted notes like "https://x.com (the WAHA app)"), strip
 * trailing slashes. Foolproof against copy-paste of descriptive text.
 */
function cleanUrl(raw: string | undefined, fallback = ""): string {
  const first = String(raw ?? "").trim().split(/\s+/)[0] ?? "";
  return (first || fallback).replace(/\/+$/, "");
}

/** Keep digits only (phone numbers): strips "+", spaces, and any trailing notes. */
function digitsOnly(raw: string | undefined): string {
  return String(raw ?? "").replace(/[^\d]/g, "");
}

/** Trim a plain token (keys/tokens shouldn't contain spaces). */
function cleanToken(raw: string | undefined): string {
  return String(raw ?? "").trim();
}

export const config = {
  port: parsePort(process.env.PORT, 8090),
  webhookToken: cleanToken(process.env.WEBHOOK_TOKEN),

  waha: {
    baseUrl: cleanUrl(process.env.WAHA_BASE_URL, "http://localhost:3001"),
    session: cleanToken(process.env.WAHA_SESSION) || "default",
    apiKey: cleanToken(process.env.WAHA_API_KEY),
  },

  gemini: {
    apiKey: cleanToken(process.env.GEMINI_API_KEY),
    model: cleanToken(process.env.GEMINI_MODEL) || "gemini-2.5-flash",
    embedModel: cleanToken(process.env.GEMINI_EMBED_MODEL) || "gemini-embedding-001",
  },

  bitrixApiBase: cleanUrl(req("BITRIX_API_BASE")),

  // Public base URL for project media (Cloudflare R2 custom domain).
  mediaBaseUrl: cleanUrl(process.env.MEDIA_BASE_URL, "https://media.premierchoiceint.online"),

  contacts: {
    salesManager: digitsOnly(process.env.SALES_MANAGER_WHATSAPP),
    teamB2B: digitsOnly(process.env.TEAM_B2B_WHATSAPP),
    teamB2C: digitsOnly(process.env.TEAM_B2C_WHATSAPP),
    teamCare: digitsOnly(process.env.TEAM_CARE_WHATSAPP),
  },
} as const;
