import { describe, expect, it } from "vitest";
import { actionEventId, confirmedActionEvent } from "./action-event";
import type { ActionItem } from "./action-models";

const action = { id: "a1", title: "Register for race", deadline: "2026-11-26", timezone: "America/New_York", category: "sports", urgency: "high", confidence: 0.8, status: "open", sourceMessageId: "m1", evidencePhrase: "November 26", extractionVersion: "v1", createdAt: "2026-11-10T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z", expiresAt: "2027-12-11T00:00:00Z" } as ActionItem;

describe("confirmed action calendar events", () => {
  it("creates a pending all-day event from a date-only action", () => {
    const event = confirmedActionEvent(action, new Date("2026-11-11T00:00:00Z"));
    expect(event).toMatchObject({ title: "Register for race", allDay: true, source: "action_confirmed", sourceActionId: "a1", status: "confirmed" });
    expect(event?.confirmedAt).toEqual(new Date("2026-11-11T00:00:00Z"));
    expect(event?.id).toBe(actionEventId("a1", "2026-11-26T00:00:00.000Z"));
  });
  it("does not create an event without a usable date", () => {
    expect(confirmedActionEvent({ ...action, deadline: undefined, relatedEventDate: undefined })).toBeNull();
  });
});
