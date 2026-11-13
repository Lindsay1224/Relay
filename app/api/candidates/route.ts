import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { listCollection } from "../../../lib/platform";
import { newestPerThread } from "../../../lib/thread-models";
import { rankMessage } from "../../../lib/attention-ranking";
import { validActionItem } from "../../../lib/action-models";

const DISPLAY_CATEGORIES = new Set(["school", "sports", "home", "medical", "bills"]);
type CandidateRecord = Record<string, unknown> & { id: string; threadId: string; receivedAt: string; sender?: string; subject?: string; excerpt?: string; relevanceScore?: number; sanitizedReason?: string; category?: string };

export async function GET() {
  try {
    const { uid } = await requireSession();
    const records = await listCollection(`users/${uid}/messageProcessing`) as Array<Record<string, unknown>>;
    const actionRecords = await listCollection(`users/${uid}/actions`);
    const activeActions = actionRecords.filter(validActionItem).filter((action) => action.status === "open" || action.status === "snoozed");
    const actionMessageIds = new Set(activeActions.map((action) => action.sourceMessageId));
    const actionThreadIds = new Set(activeActions.map((action) => action.sourceThreadId).filter(Boolean));
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const threadRecords = records
      .filter((record) => record.status === "relevant" && DISPLAY_CATEGORIES.has(String(record.category ?? "")) && typeof record.receivedAt === "string" && Date.parse(record.receivedAt) >= cutoff)
      .filter((record): record is CandidateRecord => typeof record.id === "string" && typeof record.threadId === "string" && typeof record.receivedAt === "string");
    const deduped: CandidateRecord[] = newestPerThread(threadRecords);
    const candidates = deduped
      .map((record): CandidateRecord & { attentionTier: string; attentionRank: number } => { const ranking = rankMessage({ relevanceScore: Number(record.relevanceScore ?? 0), hasOpenAction: actionMessageIds.has(record.id) || actionThreadIds.has(record.threadId), hasCalendarCandidate: Number(record.inferenceCount ?? 0) > 0 }); return { ...record, attentionTier: ranking.attentionTier, attentionRank: ranking.attentionRank }; })
      .sort((a, b) => b.attentionRank - a.attentionRank || (Date.parse(String(b.receivedAt)) || 0) - (Date.parse(String(a.receivedAt)) || 0))
      .slice(0, 50)
      .map((record) => ({
        id: record.id, sender: record.sender, subject: record.subject, receivedAt: record.receivedAt, excerpt: record.excerpt, relevanceScore: record.relevanceScore, sanitizedReason: record.sanitizedReason, category: record.category, attentionTier: record.attentionTier,
        gmailThreadUrl: typeof record.threadId === "string" ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(record.threadId)}` : null,
      }));
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
