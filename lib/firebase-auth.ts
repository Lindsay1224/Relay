type FirebaseIdentity = { idToken: string; localId: string; email?: string };

function apiKey() {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw new Error("FIREBASE_WEB_API_KEY is not configured");
  return key;
}

export async function signInWithGoogleIdToken(idToken: string): Promise<FirebaseIdentity> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestUri: process.env.RELAY_APP_URL, returnSecureToken: true, postBody: new URLSearchParams({ id_token: idToken, providerId: "google.com" }).toString() }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Firebase Authentication sign-in failed");
  const value = await response.json() as { idToken: string; localId: string; email?: string };
  return value;
}

export async function verifyFirebaseIdToken(idToken: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Invalid Firebase session");
  const value = await response.json() as { users?: Array<{ localId: string; email?: string }> };
  const user = value.users?.[0];
  if (!user) throw new Error("Firebase user not found");
  return user;
}
