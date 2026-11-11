import { describe, expect, it } from "vitest";
import { calendarEventId, parseIcs } from "./calendar-stage.js";

describe("calendar parsing stage", () => {
  it("parses all-day and UTC events without retaining raw ICS", () => {
    const events = parseIcs([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:school-1",
      "SUMMARY:Field trip",
      "DTSTART;VALUE=DATE:20261115",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:practice-1",
      "SUMMARY:Practice",
      "DTSTART:20261116T213000Z",
      "DTEND:20261116T223000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"), "America/New_York", "fingerprint");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ title: "Field trip", allDay: true, calendarUid: "school-1", status: "active" });
    expect(events[1]).toMatchObject({ title: "Practice", startAt: "2026-11-16T21:30:00.000Z", endAt: "2026-11-16T22:30:00.000Z" });
  });

  it("skips malformed events and produces deterministic IDs", () => {
    const events = parseIcs("BEGIN:VEVENT\nSUMMARY:Missing start\nEND:VEVENT", "America/New_York", "fingerprint");
    expect(events).toEqual([]);
    const input = { sourceFingerprint: "fingerprint", calendarUid: "uid", startAt: "2026-11-16T21:30:00.000Z" };
    expect(calendarEventId(input)).toBe(calendarEventId({ ...input }));
  });
});
