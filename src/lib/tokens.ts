import { createHash, createHmac, randomBytes } from "node:crypto";

/** Zufälliges URL-sicheres Token mit 256 Bit. Klartext nur einmal anzeigen, nie speichern. */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 als Hex. Identisch zur DB-Funktion `accept_friend_link`
 * (encode(sha256(convert_to(token,'UTF8')),'hex')).
 */
export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Connector-Tokens beginnen mit `hdm_` (Hub Dome MCP), gefolgt von 256 Bit Zufall. */
export const MCP_TOKEN_PATTERN = /^hdm_[A-Za-z0-9_-]{43}$/;

export function generateMcpToken() {
  return `hdm_${generateToken()}`;
}

/**
 * HMAC-SHA256 mit dem geheimen `TOKEN_PEPPER` (nur Server). Gespeichert wird nur dieser Hash; ohne den Pepper
 * lassen sich Tokens aus einer gestohlenen Datenbank nicht prüfen oder erraten.
 */
export function hashMcpToken(token: string, pepper = process.env.TOKEN_PEPPER) {
  if (!pepper || pepper.length < 32) throw new Error("TOKEN_PEPPER fehlt oder ist zu kurz.");
  return createHmac("sha256", pepper).update(token, "utf8").digest("hex");
}
