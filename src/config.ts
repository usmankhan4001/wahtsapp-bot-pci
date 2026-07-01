// Centralized, typed access to environment configuration.
// Loaded once at startup; everything else imports `config`.

function parsePort(raw: string | undefined, fallback: number): number {
  const p = Number(String(raw ?? "").trim());
  return Number.isInteger(p) && p > 0 && p < 65536 ? p : fallback;
}

function cleanUrl(raw: string | undefined, fallback = ""): string {
  const first = String(raw ?? "").trim().split(/\s+/)[0] ?? "";
  return (first || fallback).replace(/\/+$/, "");
}

function cleanToken(raw: string | undefined): string {
  return String(raw ?? "").trim();
}

/** Parses a comma-separated list of numbers into an array of clean digit-only strings. */
function parseAuthorizedNumbers(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => s.replace(/[^\d]/g, ""))
    .filter(Boolean);
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
  },

  // Authorized numbers who can use the bot (sales team)
  adminNumbers: parseAuthorizedNumbers(process.env.ADMIN_SALES_NUMBERS),
  standardNumbers: parseAuthorizedNumbers(process.env.STANDARD_SALES_NUMBERS),
} as const;
