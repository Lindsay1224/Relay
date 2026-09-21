import { cookies } from "next/headers";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const cookieName = "relay_session";
const maxAge = 60 * 60 * 24 * 14;

function auth() {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT });
  return getAuth();
}

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

/** Firebase Admin signs the httpOnly cookie; no session state is stored in Firestore. */
export async function createSession(idToken: string) {
  return auth().createSessionCookie(idToken, { expiresIn: maxAge * 1000 });
}

export async function setSessionCookie(value: string) {
  (await cookies()).set(cookieName, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge, path: "/" });
}

export async function requireSession() {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) throw new Error("Authentication required");
  try {
    const session = await auth().verifySessionCookie(value, true);
    return { uid: session.uid, email: session.email };
  } catch { throw new Error("Authentication required"); }
}

export async function clearSessionCookie() { (await cookies()).delete(cookieName); }
