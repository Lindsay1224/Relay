import { describe, expect, it } from "vitest";
import { annotateConflicts, eventsConflict, eventFeedbackStatus, projectionId } from "./event-projection";

describe("event projection lifecycle", () => {
  it("uses deterministic projection ids", () => expect(projectionId("mail:1", "2026-01-01T10:00:00.000Z")).toBe(projectionId("mail:1", "2026-01-01T10:00:00.000Z")));
  it("flags overlapping events without suppressing either", () => {
    const events = annotateConflicts([{ id: "a", title: "A", startAt: "2026-01-01T10:00:00Z" }, { id: "b", title: "B", startAt: "2026-01-01T10:30:00Z" }]);
    expect(eventsConflict(events[0], events[1])).toBe(true);
    expect(events.every((event) => event.hasConflict)).toBe(true);
    expect(events[0].conflictIds).toEqual(["b"]);
  });
  it("keeps feedback transitions explicit", () => {
    expect(eventFeedbackStatus("pending_confirmation", "confirm")).toBe("confirmed");
    expect(eventFeedbackStatus("confirmed", "remove")).toBe("removed");
    expect(eventFeedbackStatus("removed", "restore")).toBe("pending_confirmation");
  });
});
