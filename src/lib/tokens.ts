import { createHash, randomBytes } from "node:crypto";

/** Zufälliges URL-sicheres Token mit 256 Bit. Klartext nur einmal anzeigen, nie speichern. */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 als Hex. Identisch zur DB-Funktion `accept_invite`
 * (encode(sha256(convert_to(token,'UTF8')),'hex')).
 */
export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
