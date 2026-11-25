import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

export function normalizeAdminEmail(email) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email) {
  return email.length <= 254 && /^[a-z0-9][a-z0-9._+-]*@lamduan\.mfu\.ac\.th$/.test(email);
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, options);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  // Keep the same work factor when the account is absent.
  const [salt, hex] = (stored ?? `${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
  const expected = Buffer.from(hex, "hex");
  const key = await derive(password, salt, 64, options);
  return expected.length === key.length && timingSafeEqual(expected, key) && stored != null;
}
