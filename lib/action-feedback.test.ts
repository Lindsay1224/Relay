import { describe, expect, it } from "vitest";
import { feedbackUpdate } from "./action-feedback";
import type { ActionItem } from "./action-models";

const action = { id: "a1", title: "Register", category: "sports", urgency: "high", confidence: 0.8, status: "open", timezone: "America/New_York", sourceMessageId: "m1", evidencePhrase: "Register by Nov 26", extractionVersion: "v1", createdAt: "2026-11-10T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z", expiresAt: "2027-12-11T00:00:00Z" } as ActionItem;

describe("action feedback transitions", () => {
  it("raises confidence on confirmation and caps at one", () => {
    expect(feedbackUpdate({ ...action, confidence: 0.95 }, "confirm", new Date("2026-11-10T00:00:00Z")).confidence).toBe(1);
  });
  it("lowers confidence and dismisses an incorrect action", () => {
    expect(feedbackUpdate(action, "dismiss", new Date("2026-11-10T00:00:00Z"))).toMatchObject({ status: "dismissed", confidence: 0.65 });
  });
  it("sets a bounded one-day snooze", () => {
    expect(feedbackUpdate(action, "snooze", new Date("2026-11-10T00:00:00Z")).snoozedUntil).toEqual(new Date("2026-11-11T00:00:00Z"));
  });
});
