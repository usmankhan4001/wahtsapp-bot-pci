// Centralized, typed access to environment configuration.
// Loaded once at startup; everything else imports `config`.

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8090),
  webhookToken: process.env.WEBHOOK_TOKEN ?? "",

  waha: {
    baseUrl: req("WAHA_BASE_URL", "http://localhost:3001").replace(/\/$/, ""),
    session: process.env.WAHA_SESSION ?? "default",
    apiKey: process.env.WAHA_API_KEY ?? "",
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  },

  bitrixApiBase: (process.env.BITRIX_API_BASE ?? "").replace(/\/$/, ""),

  contacts: {
    salesManager: process.env.SALES_MANAGER_WHATSAPP ?? "",
    teamB2B: process.env.TEAM_B2B_WHATSAPP ?? "",
    teamB2C: process.env.TEAM_B2C_WHATSAPP ?? "",
    teamCare: process.env.TEAM_CARE_WHATSAPP ?? "",
  },
} as const;
