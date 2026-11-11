import { NextResponse } from "next/server";
import { requireSession } from "../../../../../lib/firebase-auth";
import { getDocument, setDocument } from "../../../../../lib/platform";
import { validActionItem } from "../../../../../lib/action-models";
import { ACTION_FEEDBACK_TYPES, feedbackUpdate, type ActionFeedbackType } from "../../../../../lib/action-feedback";


export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireSession();
    const { id } = await context.params;
    const path = `users/${uid}/actions/${encodeURIComponent(id)}`;
    const action = await getDocument(path);
    if (!action || !validActionItem(action)) return NextResponse.json({ error: "Action not found" }, { status: 404 });
    const body = await request.json() as { action?: string; title?: string; description?: string; deadline?: string; category?: string; urgency?: string };
    if (!body.action || !ACTION_FEEDBACK_TYPES.includes(body.action as ActionFeedbackType)) return NextResponse.json({ error: "Invalid feedback action" }, { status: 400 });
    const now = new Date();
    const fields: Record<string, unknown> = {};
    if (body.action === "edit") {
      if (typeof body.title === "string" && body.title.trim()) fields.title = body.title.trim().slice(0, 240);
      if (typeof body.description === "string") fields.description = body.description.trim().slice(0, 700);
      if (typeof body.deadline === "string" && !Number.isNaN(Date.parse(body.deadline))) fields.deadline = body.deadline;
      if (typeof body.category === "string" && ["school", "sports", "medical", "home", "bills", "other"].includes(body.category)) fields.category = body.category;
      if (typeof body.urgency === "string" && ["low", "normal", "high", "urgent"].includes(body.urgency)) fields.urgency = body.urgency;
    }
    const update = feedbackUpdate(action, body.action as ActionFeedbackType, now, fields);
    await setDocument(path, update);
    await setDocument(`${path}/feedback/${Date.now()}`, { targetId: id, feedbackType: body.action, createdAt: now });
    return NextResponse.json({ ok: true, action: await getDocument(path) });
  } catch { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); }
}
