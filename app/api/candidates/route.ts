import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { listCollection } from "../../../lib/platform";

export async function GET() {
  try {
    const { uid } = await requireSession();
    const records = await listCollection(`users/${uid}/messageProcessing`) as Array<Record<string, unknown>>;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const candidates = records
      .filter((record) => record.status === "relevant" && typeof record.receivedAt === "string" && Date.parse(record.receivedAt) >= cutoff)
      .sort((a, b) => String(b.receivedAt ?? b.processedAt ?? "").localeCompare(String(a.receivedAt ?? a.processedAt ?? "")))
      .slice(0, 50)
      .map(({ id, sender, subject, receivedAt, excerpt, threadId, relevanceScore, sanitizedReason }) => ({
        id, sender, subject, receivedAt, excerpt, relevanceScore, sanitizedReason,
        gmailThreadUrl: typeof threadId === "string" ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}` : null,
      }));
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
