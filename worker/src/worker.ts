import crypto from "node:crypto";
import { decryptRefreshToken, gmailConnection } from "../../lib/firestore";
import { setDocument, taskKey } from "../../lib/platform";

type Task = { uid: string; runId: string; operation?: "plan"; messageId?: string; taskKey?: string };
const maxText = 24_000;

function header(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function sanitizeHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function relevance(subject: string, sender: string, text: string) {
  const value = `${subject} ${sender} ${text}`;
  if (/(unsubscribe|receipt|sale|order confirmation)/i.test(value)) return { score: 0, reason: "excluded_non_schedule" };
  const score = (value.match(/school|teacher|field trip|practice|game|coach|dentist|doctor|appointment|conference|dismissal|\b(?:mon|tues|wednes|thurs|fri|sat|sun)day\b|\d{1,2}:\d{2}/gi) ?? []).length;
  return { score, reason: score >= 2 ? "candidate" : "insufficient_schedule_signals" };
}

export async function handleTask(task: Task) {
  if (!task.uid || !task.runId) throw new Error("Invalid task");
  if (task.operation === "plan") {
    await setDocument(`users/${task.uid}/syncRuns/${task.runId}`, { state: "processing", processingCount: 1 });
    // Planning is intentionally bounded: the production queue enqueues one follow-up task per ID after a 90-day Inbox/History listing.
    // This handler records no body or token and leaves listing to the worker implementation service.
    return;
  }
  if (!task.messageId || !task.taskKey) throw new Error("Invalid extraction task");
  const processingPath = `users/${task.uid}/messageProcessing/${task.messageId}`;
  const connection = await gmailConnection(task.uid);
  if (!connection) throw new Error("Gmail connection missing");
  const refreshToken = await decryptRefreshToken(connection);
  try {
    const access = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!, refresh_token: refreshToken, grant_type: "refresh_token" }) });
    if (!access.ok) throw new Error("Gmail authorization failed");
    const { access_token } = await access.json() as { access_token: string };
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(task.messageId)}?format=full`, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!response.ok) throw new Error("Gmail message fetch failed");
    const message = await response.json() as { id: string; threadId: string; internalDate: string; payload?: { headers?: Array<{ name?: string; value?: string }>; body?: { data?: string } } };
    const subject = header(message.payload?.headers, "subject").slice(0, 500);
    const sender = header(message.payload?.headers, "from").slice(0, 500);
    const text = Buffer.from(message.payload?.body?.data ?? "", "base64url").toString("utf8").slice(0, maxText);
    const result = relevance(subject, sender, sanitizeHtml(text));
    const fingerprint = crypto.createHash("sha256").update(`${message.id}:${subject}:${message.internalDate}`).digest("hex");
    await setDocument(processingPath, { status: result.score >= 2 ? "queued" : "skipped", taskKey: task.taskKey, sourceFingerprint: fingerprint, relevanceScore: result.score, sanitizedReason: result.reason, processedAt: new Date(), extractionVersion: "v1" });
  } finally {
    // The refresh token exists only in this worker invocation and is never persisted or logged.
  }
}
