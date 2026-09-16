import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ScheduleEvent } from "../../../lib/gmail";
import { openSchedule } from "../../../lib/schedule-session";

export async function GET() {
  const value = (await cookies()).get("relay_schedule")?.value;
  if (!value) return NextResponse.json({ events: [] });
  try {
    return NextResponse.json({ events: openSchedule<ScheduleEvent[]>(value) });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
