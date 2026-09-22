import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { gmailConnection, migrateLegacyConnection, saveGmailConnection } from "../../../lib/firestore";
import { runtimeAccessToken, setDocument } from "../../../lib/platform";

const cooldownMs = 5 * 60 * 1000;

export async function POST() {
  try {
    const { uid } = await requireSession();
    const connection = await migrateLegacyConnection(uid) ?? await gmailConnection(uid);
    if (!connection?.tokenCiphertext) return NextResponse.json({ error: "Gmail reconnect required" }, { status: 409 });
    const lastValue = connection.sync?.lastManualSyncAt;
    const last = typeof lastValue === "string" ? new Date(lastValue).getTime() : 0;
    if (Date.now() - last < cooldownMs) return NextResponse.json({ error: "Please wait before starting another sync" }, { status: 429 });
    const runId = crypto.randomUUID();
    await saveGmailConnection(uid, { ...connection, sync: { ...(connection.sync ?? {}), lastManualSyncAt: new Date(), state: "queued", queuedCount: 0, processingCount: 0, processedCount: 0, candidateCount: 0, skippedCount: 0, failedCount: 0 } });
    await setDocument(`users/${encodeURIComponent(uid)}/syncRuns/${runId}`, { state: "queued", startedAt: new Date(), plannedCount: 0, queuedCount: 0, processingCount: 0, processedCount: 0, skippedCount: 0, failedCount: 0 });
    // The worker obtains message IDs and creates deterministic per-message tasks; no Gmail data crosses this route.
    const taskUrl = process.env.RELAY_WORKER_URL;
    const queue = process.env.RELAY_TASKS_QUEUE;
    if (!taskUrl || !queue) throw new Error("Sync queue is not configured");
    const token = await runtimeAccessToken();
    const project = process.env.GOOGLE_CLOUD_PROJECT ?? "relay-family-schedule";
    const location = process.env.RELAY_TASKS_LOCATION ?? "us-east4";
    const response = await fetch(`https://cloudtasks.googleapis.com/v2/projects/${project}/locations/${location}/queues/${queue}/tasks`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ task: { httpRequest: { httpMethod: "POST", url: taskUrl, oidcToken: { serviceAccountEmail: process.env.RELAY_TASKS_SERVICE_ACCOUNT, audience: taskUrl }, headers: { "Content-Type": "application/json" }, body: Buffer.from(JSON.stringify({ uid, runId, operation: "plan" })).toString("base64") } } }),
    });
    if (!response.ok) throw new Error("Unable to queue sync");
    return NextResponse.json({ runId, state: "queued" }, { status: 202 });
  } catch (error) {
    // Keep the browser response generic, but retain a credential/body-free diagnostic in Cloud Run logs.
    console.error("Relay sync planner failed", error instanceof Error ? error.message : "unknown_error");
    const status = error instanceof Error && error.message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : "Unable to start sync" }, { status });
  }
}
