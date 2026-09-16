import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 500 });
  const appUrl = process.env.RELAY_APP_URL ?? new URL(request.url).origin;
  const state = crypto.randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set("relay_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${appUrl}/api/auth/callback/google`, response_type: "code", access_type: "offline", prompt: "consent", state, scope: "openid email https://www.googleapis.com/auth/gmail.readonly" }).toString();
  return NextResponse.redirect(authorization);
}
