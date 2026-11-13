import crypto from "node:crypto";
import type { EventStatus } from "./models";

export const EVENT_PROJECTION_VERSION = "calendar-v1";
export type ProjectedEvent = { id?: string; title?: string; startAt?: string; endAt?: string; allDay?: boolean; status?: EventStatus; [key: string]: unknown };

export function projectionId(sourceFingerprint: string, startAt: string) {
  return crypto.createHash("sha256").update(`${EVENT_PROJECTION_VERSION}:${sourceFingerprint}:${startAt}`).digest("hex").slice(0, 40);
}

function interval(event: ProjectedEvent) {
  const start = Date.parse(String(event.startAt ?? ""));
  const end = event.endAt && Number.isFinite(Date.parse(event.endAt)) ? Date.parse(event.endAt) : start + (event.allDay ? 86400000 : 3600000);
  return { start, end: Math.max(start, end) };
}

export function eventsConflict(a: ProjectedEvent, b: ProjectedEvent) {
  if (a.id && b.id && a.id === b.id) return false;
  const left = interval(a), right = interval(b);
  return Number.isFinite(left.start) && Number.isFinite(right.start) && left.start < right.end && right.start < left.end;
}

export function annotateConflicts<T extends ProjectedEvent>(events: T[]) {
  const conflicts = new Map<string, string[]>();
  for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
    if (!eventsConflict(events[i], events[j])) continue;
    const a = String(events[i].id ?? i), b = String(events[j].id ?? j);
    conflicts.set(a, [...(conflicts.get(a) ?? []), b]);
    conflicts.set(b, [...(conflicts.get(b) ?? []), a]);
  }
  return events.map((event, index) => ({ ...event, projectionVersion: EVENT_PROJECTION_VERSION, hasConflict: (conflicts.get(String(event.id ?? index)) ?? []).length > 0, conflictIds: conflicts.get(String(event.id ?? index)) ?? [] }));
}

export function eventFeedbackStatus(current: unknown, action: "confirm" | "remove" | "restore") {
  if (action === "confirm") return "confirmed" as const;
  if (action === "remove") return "removed" as const;
  return "pending_confirmation" as const;
}
