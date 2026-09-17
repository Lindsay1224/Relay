import { sealSchedule } from "./schedule-session";

async function runtimeAccessToken() {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to authenticate to Firestore");
  return (await response.json() as { access_token: string }).access_token;
}

export async function storeGmailRefreshToken(uid: string, email: string | undefined, refreshToken: string | undefined) {
  if (!refreshToken) return;
  const accessToken = await runtimeAccessToken();
  const fields = {
    encryptedRefreshToken: { stringValue: sealSchedule(refreshToken) },
    email: { stringValue: email ?? "" },
    updatedAt: { timestampValue: new Date().toISOString() },
  };
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT ?? "relay-family-schedule"}/databases/(default)/documents/gmailConnections/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to save Gmail connection");
}
