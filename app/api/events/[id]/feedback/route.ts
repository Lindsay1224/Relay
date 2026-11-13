import { NextResponse } from "next/server";
import { requireSession } from "../../../../../lib/firebase-auth";
import { getDocument, setDocument } from "../../../../../lib/platform";
import { eventFeedbackStatus } from "../../../../../lib/event-projection";

const allowed = new Set(["confirm", "remove", "update", "restore"]);
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireSession();
    const { id } = await context.params;
    const path = `users/${uid}/events/${encodeURIComponent(id)}`;
    const event = await getDocument(path);
    if (!event || !["email_inferred", "action_confirmed", "ics"].includes(String(event.source))) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const body = await request.json() as { action?: string; title?: string; startAt?: string; endAt?: string; allDay?: boolean; category?: string };
    if (!body.action || !allowed.has(body.action)) return NextResponse.json({ error: "Invalid feedback action" }, { status: 400 });
    if (body.action === "confirm" || body.action === "remove" || body.action === "restore") {
      const status = eventFeedbackStatus(event.status, body.action);
      const update: Record<string, unknown> = { status, updatedAt: new Date() };
      if (body.action === "confirm") Object.assign(update, { confidence: Math.min(1, Number(event.confidence ?? 0) + 0.1), confirmedAt: new Date() });
      if (body.action === "remove") update.removedAt = new Date();
      await setDocument(path, update);
      await setDocument(`${path}/feedback/${Date.now()}`, { targetId: id, feedbackType: body.action, createdAt: new Date() });
    }
    if (body.action === "update") {
      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim().slice(0, 240);
      if (typeof body.startAt === "string" && !Number.isNaN(Date.parse(body.startAt))) update.startAt = body.startAt;
      if (typeof body.endAt === "string" && !Number.isNaN(Date.parse(body.endAt))) update.endAt = body.endAt;
      if (typeof body.allDay === "boolean") update.allDay = body.allDay;
      if (typeof body.category === "string" && ["school", "sports", "medical", "home", "bills", "other"].includes(body.category)) update.category = body.category;
      await setDocument(path, update);
    }
    return NextResponse.json({ ok: true, event: await getDocument(path) });
  } catch { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); }
}
