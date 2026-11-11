import { NextResponse } from "next/server";
import { requireSession } from "../../../../../lib/firebase-auth";
import { getDocument, setDocument } from "../../../../../lib/platform";
import { validActionItem } from "../../../../../lib/action-models";

const allowed = new Set(["confirm", "edit", "snooze", "complete", "dismiss"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireSession();
    const { id } = await context.params;
    const path = `users/${uid}/actions/${encodeURIComponent(id)}`;
    const action = await getDocument(path);
    if (!action || !validActionItem(action)) return NextResponse.json({ error: "Action not found" }, { status: 404 });
    const body = await request.json() as { action?: string; title?: string; description?: string; deadline?: string; category?: string; urgency?: string };
    if (!body.action || !allowed.has(body.action)) return NextResponse.json({ error: "Invalid feedback action" }, { status: 400 });
    const now = new Date();
    const update: Record<string, unknown> = { updatedAt: now };
    if (body.action === "confirm") { update.confidence = Math.min(1, Number(action.confidence ?? 0) + 0.1); update.status = "open"; update.confirmedAt = now; }
    if (body.action === "complete") { update.status = "completed"; update.completedAt = now; }
    if (body.action === "dismiss") { update.status = "dismissed"; update.dismissedAt = now; }
    if (body.action === "snooze") { update.status = "snoozed"; update.snoozedUntil = new Date(now.getTime() + 86400000); }
    if (body.action === "edit") {
      if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim().slice(0, 240);
      if (typeof body.description === "string") update.description = body.description.trim().slice(0, 700);
      if (typeof body.deadline === "string" && !Number.isNaN(Date.parse(body.deadline))) update.deadline = body.deadline;
      if (typeof body.category === "string" && ["school", "sports", "medical", "home", "bills", "other"].includes(body.category)) update.category = body.category;
      if (typeof body.urgency === "string" && ["low", "normal", "high", "urgent"].includes(body.urgency)) update.urgency = body.urgency;
    }
    await setDocument(path, update);
    await setDocument(`${path}/feedback/${Date.now()}`, { targetId: id, feedbackType: body.action, createdAt: now });
    return NextResponse.json({ ok: true, action: await getDocument(path) });
  } catch { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); }
}
