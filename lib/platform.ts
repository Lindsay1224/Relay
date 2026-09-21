import crypto from "node:crypto";

const project = () => process.env.GOOGLE_CLOUD_PROJECT ?? "relay-family-schedule";
const firestoreRoot = () => `https://firestore.googleapis.com/v1/projects/${project()}/databases/(default)/documents`;

export async function runtimeAccessToken() {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" }, cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to obtain runtime credentials");
  return (await response.json() as { access_token: string }).access_token;
}

export function firestoreFields(value: Record<string, unknown>): Record<string, unknown> {
  const field = (item: unknown): unknown => {
    if (item === null) return { nullValue: null };
    if (typeof item === "string") return { stringValue: item };
    if (typeof item === "boolean") return { booleanValue: item };
    if (typeof item === "number") return { doubleValue: item };
    if (item instanceof Date) return { timestampValue: item.toISOString() };
    if (Array.isArray(item)) return { arrayValue: { values: item.map(field) } };
    return { mapValue: { fields: firestoreFields(item as Record<string, unknown>) } };
  };
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, field(v)]));
}

export function decodeFirestore(fields: Record<string, any> = {}): Record<string, any> {
  const decode = (v: any): any => {
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue" in v) return null;
    if ("mapValue" in v) return decodeFirestore(v.mapValue.fields);
    if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
    return undefined;
  };
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

export async function getDocument(path: string) {
  const token = await runtimeAccessToken();
  const response = await fetch(`${firestoreRoot()}/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Firestore read failed");
  const document = await response.json() as { fields?: Record<string, any> };
  return decodeFirestore(document.fields);
}

export async function setDocument(path: string, value: Record<string, unknown>, merge = true) {
  const token = await runtimeAccessToken();
  const suffix = merge ? "" : "?currentDocument.exists=false";
  const response = await fetch(`${firestoreRoot()}/${path}${suffix}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: firestoreFields(value) }), cache: "no-store",
  });
  if (!response.ok && !(merge && response.status === 409)) throw new Error("Firestore write failed");
}

export async function deleteDocument(path: string) {
  const token = await runtimeAccessToken();
  const response = await fetch(`${firestoreRoot()}/${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok && response.status !== 404) throw new Error("Firestore delete failed");
}

export async function listCollection(path: string) {
  const token = await runtimeAccessToken();
  const response = await fetch(`${firestoreRoot()}/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Firestore list failed");
  const value = await response.json() as { documents?: Array<{ name: string; fields?: Record<string, any> }> };
  return (value.documents ?? []).map((document) => ({ id: document.name.split("/").at(-1)!, ...decodeFirestore(document.fields) }));
}

export function opaqueSession() { return crypto.randomBytes(32).toString("base64url"); }
export function hashSecret(value: string) { return crypto.createHash("sha256").update(value).digest("base64url"); }
export function taskKey(uid: string, messageId: string, scope: string) {
  return crypto.createHash("sha256").update(`${uid}:${messageId}:${scope}:v1`).digest("hex").slice(0, 48);
}
