import crypto from "node:crypto";
import { deleteDocument, getDocument, runtimeAccessToken, setDocument } from "./platform";
import type { GmailConnection } from "./models";

async function kms(path: string, body: Record<string, string>) {
  const token = await runtimeAccessToken();
  const response = await fetch(`https://cloudkms.googleapis.com/v1/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store",
  });
  if (!response.ok) throw new Error("KMS operation failed");
  return response.json() as Promise<{ ciphertext?: string; plaintext?: string }>;
}

export async function encryptRefreshToken(refreshToken: string) {
  const key = process.env.RELAY_KMS_KEY_RESOURCE;
  if (!key) throw new Error("RELAY_KMS_KEY_RESOURCE is not configured");
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
  const encrypted = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const wrapped = await kms(`${key}:encrypt`, { plaintext: dataKey.toString("base64") });
  return {
    tokenCiphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"),
    wrappedDataKey: wrapped.ciphertext!, kmsKeyVersion: key, tokenAlgorithm: "AES-256-GCM", tokenCreatedAt: new Date(),
  };
}

export async function decryptRefreshToken(connection: Record<string, unknown>) {
  const wrappedDataKey = connection.wrappedDataKey;
  const keyVersion = connection.kmsKeyVersion;
  const packed = connection.tokenCiphertext;
  if (typeof wrappedDataKey !== "string" || typeof keyVersion !== "string" || typeof packed !== "string") throw new Error("Missing encrypted Gmail connection");
  const unwrapped = await kms(`${keyVersion}:decrypt`, { ciphertext: wrappedDataKey });
  const raw = Buffer.from(packed, "base64");
  if (!unwrapped.plaintext) throw new Error("KMS did not return a data key");
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(unwrapped.plaintext, "base64"), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export async function storeGmailRefreshToken(uid: string, email: string | undefined, refreshToken: string | undefined) {
  if (!refreshToken) return;
  await saveGmailConnection(uid, { email: email ?? "", ...(await encryptRefreshToken(refreshToken)), updatedAt: new Date() });
}

/** Firestore documents must have an even number of path segments. Store the connection map on the user document. */
export async function gmailConnection(uid: string) {
  const user = await getDocument(`users/${encodeURIComponent(uid)}`);
  return user?.gmailConnection && typeof user.gmailConnection === "object" ? user.gmailConnection as GmailConnection : null;
}

export async function saveGmailConnection(uid: string, connection: GmailConnection) {
  await setDocument(`users/${encodeURIComponent(uid)}`, { gmailConnection: connection });
}

export async function migrateLegacyConnection(uid: string) {
  const canonical = await gmailConnection(uid);
  if (canonical?.tokenCiphertext) return canonical;
  const legacy = await getDocument(`gmailConnections/${encodeURIComponent(uid)}`);
  if (!legacy) return canonical;
  const token = legacy.refreshToken ?? legacy.refresh_token;
  if (typeof token === "string" && token.length > 10) {
    await storeGmailRefreshToken(uid, typeof legacy.email === "string" ? legacy.email : undefined, token);
    await deleteDocument(`gmailConnections/${encodeURIComponent(uid)}`);
    return gmailConnection(uid);
  }
  await saveGmailConnection(uid, { email: typeof legacy.email === "string" ? legacy.email : "", migrationState: "legacy_requires_reconnect", migratedAt: new Date() });
  return gmailConnection(uid);
}
