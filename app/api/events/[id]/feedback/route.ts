import { NextResponse } from "next/server";
import { requireSession } from "../../../../../lib/firebase-auth";
import { getDocument, setDocument } from "../../../../../lib/platform";

const allowed = new Set(["confirm", "remove", "update"]);
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireSession();
    const { id } = await context.params;
    const path = `users/${uid}/events/${encodeURIComponent(id)}`;
    const event = await getDocument(path);
    if (!event || event.source !== "email_inferred") return NextResponse.json({ error: "Inferred event not found" }, { status: 404 });
    const body = await request.json() as { action?: string; title?: string; startAt?: string; endAt?: string; allDay?: boolean; category?: string };
    if (!body.action || !allowed.has(body.action)) return NextResponse.json({ error: "Invalid feedback action" }, { status: 400 });
    if (body.action === "confirm") await setDocument(path, { status: "confirmed", confidence: Math.min(1, Number(event.confidence ?? 0) + 0.1), confirmedAt: new Date(), updatedAt: new Date() });
    if (body.action === "remove") await setDocument(path, { status: "removed", removedAt: new Date(), updatedAt: new Date() });
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
