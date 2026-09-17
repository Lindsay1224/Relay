import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { gmailConnection } from "../../../lib/firestore";

export async function GET() {
  try {
    const { uid } = await requireSession();
    const connection = await gmailConnection(uid);
    const sync = connection?.sync ?? {};
    return NextResponse.json({
      state: sync.state ?? "idle", queuedCount: Number(sync.queuedCount ?? 0), processingCount: Number(sync.processingCount ?? 0),
      processedCount: Number(sync.processedCount ?? 0), skippedCount: Number(sync.skippedCount ?? 0), failedCount: Number(sync.failedCount ?? 0),
      lastSuccessfulAt: sync.lastSuccessfulAt ?? null, recoveryState: sync.recoveryState ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
