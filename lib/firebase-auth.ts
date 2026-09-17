import { cookies } from "next/headers";
import { getDocument, hashSecret, opaqueSession, setDocument } from "./platform";

const cookieName = "relay_session";
const maxAge = 60 * 60 * 24 * 14;

function apiKey() {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw new Error("FIREBASE_WEB_API_KEY is not configured");
  return key;
}

export async function signInWithGoogleIdToken(idToken: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey()}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ requestUri: process.env.RELAY_APP_URL, returnSecureToken: true, postBody: new URLSearchParams({ id_token: idToken, providerId: "google.com" }).toString() }),
  });
  if (!response.ok) throw new Error("Firebase Authentication sign-in failed");
  return await response.json() as { idToken: string; localId: string; email?: string };
}

export async function createSession(uid: string, email?: string) {
  const secret = opaqueSession();
  await setDocument(`users/${encodeURIComponent(uid)}/sessions/${hashSecret(secret)}`, {
    uid, email: email ?? "", expiresAt: new Date(Date.now() + maxAge * 1000), createdAt: new Date(),
  }, false);
  return `${uid}.${secret}`;
}

export async function setSessionCookie(value: string) {
  (await cookies()).set(cookieName, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge, path: "/" });
}

export async function requireSession() {
  const value = (await cookies()).get(cookieName)?.value;
  const [uid, secret] = value?.split(".", 2) ?? [];
  if (!uid || !secret) throw new Error("Authentication required");
  const session = await getDocument(`users/${encodeURIComponent(uid)}/sessions/${hashSecret(secret)}`);
  if (!session || session.uid !== uid || new Date(session.expiresAt) <= new Date()) throw new Error("Authentication required");
  return { uid, email: session.email as string | undefined };
}

export async function clearSessionCookie() { (await cookies()).delete(cookieName); }
