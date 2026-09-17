import { NextResponse } from "next/server";
import { requireSession } from "../../../lib/firebase-auth";
import { listCollection } from "../../../lib/platform";

export async function GET(request: Request) {
  try {
    const { uid } = await requireSession();
    const url = new URL(request.url);
    const from = new Date(url.searchParams.get("from") ?? "");
    const to = new Date(url.searchParams.get("to") ?? "");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to || to.getTime() - from.getTime() > 1000 * 60 * 60 * 24 * 366) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const events = await listCollection(`users/${uid}/events`) as Array<Record<string, unknown>>;
    return NextResponse.json({ events: events.filter((event) => {
      const start = new Date(String(event.startAt)).getTime();
      return Number.isFinite(start) && start >= from.getTime() && start < to.getTime();
    }) });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
