import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

function key() {
  const secret = process.env.RELAY_SESSION_SECRET;
  if (!secret) throw new Error("RELAY_SESSION_SECRET is not configured");
  return crypto.createHash("sha256").update(secret).digest();
}

export function sealSchedule(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openSchedule<T>(value: string): T {
  const packed = Buffer.from(value, "base64url");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const encrypted = packed.subarray(28);
  const decipher = crypto.createDecipheriv(algorithm, key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as T;
}
