import crypto from "crypto";

const PREFIX = "pbkdf2$";
const ITERATIONS = 10000;
const KEY_LEN = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST)
    .toString("hex");
  return `${PREFIX}${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (stored.startsWith(PREFIX)) {
    const [salt, hash] = stored.slice(PREFIX.length).split(":");
    if (!salt || !hash) return false;
    const computed = crypto
      .pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST)
      .toString("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(hash, "hex")
      );
    } catch {
      return false;
    }
  }
  // Legacy plain-text comparison (backward compat)
  return password === stored;
}
