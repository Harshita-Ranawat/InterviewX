import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

function getKeyBuffer() {
  const secret = process.env.INVITE_SMTP_SECRET?.trim();
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function isCryptoConfigured() {
  return Boolean(getKeyBuffer());
}

/** @param {string} plain */
export function encryptSmtpPassword(plain) {
  const key = getKeyBuffer();
  if (!key) {
    throw new Error("INVITE_SMTP_SECRET is not set on the server");
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** @param {string} stored base64 */
export function decryptSmtpPassword(stored) {
  if (!stored) return "";
  const key = getKeyBuffer();
  if (!key) return null;
  try {
    const buf = Buffer.from(stored, "base64");
    if (buf.length < IV_LEN + AUTH_TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const data = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
