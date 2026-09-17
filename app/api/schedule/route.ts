import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ScheduleEvent } from "../../../lib/gmail";
import { openSchedule } from "../../../lib/schedule-session";
import { verifyFirebaseIdToken } from "../../../lib/firebase-auth";

export async function GET() {
  const jar = await cookies();
  const auth = jar.get("relay_auth")?.value;
  if (!auth) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    await verifyFirebaseIdToken(openSchedule<{ idToken: string }>(auth).idToken);
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const value = jar.get("relay_schedule")?.value;
  if (!value) return NextResponse.json({ events: [] });
  try {
    return NextResponse.json({ events: openSchedule<ScheduleEvent[]>(value) });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
