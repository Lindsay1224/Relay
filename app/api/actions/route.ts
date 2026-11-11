import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { listCollection } from "../../../lib/platform";
import { validActionItem } from "../../../lib/action-models";

export async function GET() {
  try {
    const { uid } = await requireSession();
    const records = await listCollection(`users/${uid}/actions`) as Array<Record<string, unknown>>;
    const now = Date.now();
    const actions = records.filter(validActionItem).filter((action) => action.status === "open" || (action.status === "snoozed" && Date.parse(String(action.snoozedUntil ?? 0)) <= now)).sort((a, b) => Date.parse(String(a.deadline ?? "9999-12-31")) - Date.parse(String(b.deadline ?? "9999-12-31"))).slice(0, 50).map(({ id, title, description, deadline, deadlineType, relatedEventDate, timezone, category, urgency, confidence, status, sourceMessageId, sourceThreadId, evidencePhrase }) => ({ id, title, description, deadline, deadlineType, relatedEventDate, timezone, category, urgency, confidence, status: status === "snoozed" ? "open" : status, sourceMessageId, sourceThreadId, evidencePhrase }));
    return NextResponse.json({ actions });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
