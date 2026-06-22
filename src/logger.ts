// Minimal timestamped logger. Swap for winston later if structured logs are needed.
const ts = () => new Date().toISOString();

export const logger = {
  info: (...a: unknown[]) => console.log(ts(), "INFO ", ...a),
  warn: (...a: unknown[]) => console.warn(ts(), "WARN ", ...a),
  error: (...a: unknown[]) => console.error(ts(), "ERROR", ...a),
};
