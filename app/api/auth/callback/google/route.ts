import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, signInWithGoogleIdToken } from "../../../../../lib/firebase-auth";
import { storeGmailRefreshToken } from "../../../../../lib/firestore";

export async function GET(request: Request) {
  const appUrl = process.env.RELAY_APP_URL ?? new URL(request.url).origin;
  const url = new URL(request.url);
  const jar = await cookies();
  const expectedState = jar.get("relay_oauth_state")?.value;
  jar.delete("relay_oauth_state");
  if (!url.searchParams.get("code") || !expectedState || url.searchParams.get("state") !== expectedState) return NextResponse.redirect(new URL("/?error=oauth", appUrl));

  try {
    const token = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: url.searchParams.get("code")!, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!, redirect_uri: `${appUrl}/api/auth/callback/google`, grant_type: "authorization_code" }) });
    if (!token.ok) throw new Error("Token exchange failed");
    const { refresh_token, id_token } = await token.json() as { refresh_token?: string; id_token?: string };
    if (!id_token) throw new Error("Google identity token missing");
    const firebaseUser = await signInWithGoogleIdToken(id_token);
    await storeGmailRefreshToken(firebaseUser.localId, firebaseUser.email, refresh_token);
    const response = NextResponse.redirect(new URL("/?connected=1", appUrl));
    response.cookies.set("relay_session", await createSession(firebaseUser.localId, firebaseUser.email), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 14, path: "/" });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=gmail", appUrl));
  }
}
