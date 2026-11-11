import { gmailConnection, saveGmailConnection } from "../../lib/firestore.js";
import { evidenceExpiry } from "../../lib/policies.js";
import { getDocument, incrementDocument, setDocument } from "../../lib/platform.js";
import { calendarEventId, type CalendarEvent } from "./calendar-stage.js";
import type { SettledStatus, WorkerTask } from "./worker-contracts.js";

type CalendarEvidence = { sender: string; subject: string; receivedAt: string; excerpt: string; threadId: string };

export async function persistCalendarEvents(uid: string, events: CalendarEvent[], evidence: CalendarEvidence) {
  const from = Date.now() - 31 * 86400000;
  const to = Date.now() + 93 * 86400000;
  for (const event of events) {
    const start = Date.parse(event.startAt);
    if (!Number.isFinite(start) || start < from || start >= to) continue;
    const id = calendarEventId(event);
    const path = `users/${uid}/events/${id}`;
    await setDocument(path, { ...event, id, source: "ics", updatedAt: new Date(), createdAt: new Date() });
    await setDocument(`${path}/evidence/${event.sourceFingerprint}`, { ...evidence, expiresAt: evidenceExpiry() });
  }
}

export async function persistCanonicalMessage(uid: string, message: Record<string, unknown>) {
  await setDocument(`users/${uid}/messages/${encodeURIComponent(String(message.gmailMessageId))}`, message);
}

export async function settleTask(task: WorkerTask, status: SettledStatus) {
  const runPath = `users/${task.uid}/syncRuns/${task.runId}`;
  const key = `${status}Count`;
  await incrementDocument(runPath, [key, "completedCount"]);
  const run = await getDocument(runPath) ?? {};
  const completed = Number(run.completedCount ?? 0);
  const planned = Number(run.plannedCount ?? 0);
  const failed = Number(run.failedCount ?? 0);
  await setDocument(runPath, {
    processingCount: Math.max(0, planned - completed),
    updatedAt: new Date(),
    ...(completed >= planned ? { state: failed ? "attention_needed" : "complete", completedAt: new Date() } : {}),
  });
  const connection = await gmailConnection(task.uid);
  const sync = connection?.sync ?? {};
  if (connection) {
    await saveGmailConnection(task.uid, {
      ...connection,
      sync: {
        ...sync,
        state: completed >= planned ? (failed ? "attention_needed" : "complete") : "processing",
        [key]: Number(sync[key] ?? 0) + 1,
        processingCount: Math.max(0, planned - completed),
        ...(completed >= planned ? { lastSuccessfulAt: failed ? sync.lastSuccessfulAt ?? null : new Date() } : {}),
      },
    });
  }
}
