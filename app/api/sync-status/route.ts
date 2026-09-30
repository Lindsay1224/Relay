import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { gmailConnection } from "../../../lib/firestore";
import { getDocument } from "../../../lib/platform";

export async function GET() {
  try {
    const { uid } = await requireSession();
    const connection = await gmailConnection(uid);
    const sync = connection?.sync ?? {};
    const run = typeof sync.lastRunId === "string" ? await getDocument(`users/${uid}/syncRuns/${sync.lastRunId}`) : null;
    const source = run ?? sync;
    const completedCount = Number(source.completedCount ?? 0);
    const plannedCount = Number(source.plannedCount ?? 0);
    return NextResponse.json({
      state: source.state ?? sync.state ?? "idle", queuedCount: Number(source.queuedCount ?? 0), processingCount: Math.max(Number(source.processingCount ?? 0), Math.max(0, plannedCount - completedCount)),
      processedCount: Number(source.processedCount ?? 0), relevantCount: Number(source.relevantCount ?? 0), candidateCount: Number(source.candidateCount ?? 0), skippedCount: Number(source.skippedCount ?? 0), failedCount: Number(source.failedCount ?? 0),
      lastSuccessfulAt: sync.lastSuccessfulAt ?? null, recoveryState: sync.recoveryState ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
