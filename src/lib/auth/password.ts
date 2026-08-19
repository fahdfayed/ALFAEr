import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * scrypt with a per-password random salt. Stored as "scrypt$<salt>$<hash>" so
 * the format carries its own algorithm tag and can be migrated later without
 * having to guess what produced an existing hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "base64");
  const expected = Buffer.from(parts[2], "base64");
  if (expected.length !== KEY_LENGTH) return false;

  const derived = await scrypt(password, salt, KEY_LENGTH);
  // Length is checked first because timingSafeEqual throws on a length
  // mismatch rather than returning false.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export interface PasswordProblem {
  message: string;
}

/**
 * Deliberately modest rules. Length does the work; complexity requirements
 * mostly produce written-down passwords, and on a site office wall that is a
 * worse outcome than a long simple one.
 */
export function checkPasswordStrength(password: string): PasswordProblem | null {
  if (password.length < 10) {
    return { message: "Password must be at least 10 characters." };
  }
  if (password.length > 200) {
    return { message: "Password must be 200 characters or fewer." };
  }
  if (/^\s|\s$/.test(password)) {
    return { message: "Password cannot start or end with a space." };
  }
  const common = ["password12", "1234567890", "qwertyuiop", "passw0rd12"];
  if (common.includes(password.toLowerCase())) {
    return { message: "That password is too easy to guess." };
  }
  return null;
}
