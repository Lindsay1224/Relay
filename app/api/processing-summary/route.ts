import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { listCollection } from "../../../lib/platform";
import { validMessageDecision } from "../../../lib/message-decision";

export async function GET() {
  try {
    const { uid } = await requireSession();
    const records = await listCollection(`users/${uid}/messageDecisions`);
    const decisions = records.filter(validMessageDecision);
    const byReason: Record<string, number> = {};
    for (const decision of decisions) byReason[decision.sanitizedReason] = (byReason[decision.sanitizedReason] ?? 0) + 1;
    const latest = decisions.map((decision) => Date.parse(decision.decidedAt)).filter(Number.isFinite).sort((a, b) => b - a)[0];
    return NextResponse.json({ total: decisions.length, includedCount: decisions.filter((d) => d.disposition === "included").length, needsReviewCount: decisions.filter((d) => d.disposition === "needs_review").length, excludedCount: decisions.filter((d) => d.disposition === "excluded").length, failedCount: decisions.filter((d) => d.disposition === "failed").length, byReason, lastDecidedAt: latest ? new Date(latest).toISOString() : null });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
