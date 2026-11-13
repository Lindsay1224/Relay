import { describe, expect, it } from "vitest";
import { validActionExtraction, validActionItem } from "./action-models";
import { EVENT_FUTURE_DAYS, EVENT_PAST_DAYS, MESSAGE_LOOKBACK_HOURS, evidenceExpiry, windowFrom } from "./policies";

describe("phase-one shared policies", () => {
  it("defines the agreed processing windows", () => {
    expect(MESSAGE_LOOKBACK_HOURS).toBe(24);
    expect(EVENT_PAST_DAYS).toBe(30);
    expect(EVENT_FUTURE_DAYS).toBe(365);
  });
  it("creates a four-hundred-day calendar window", () => {
    const now = new Date("2026-11-10T00:00:00.000Z");
    const range = windowFrom(now);
    expect(range.from.toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2027-11-10T00:00:00.000Z");
  });
  it("uses the retention policy for evidence expiry", () => {
    const now = new Date("2026-11-10T00:00:00.000Z");
    expect(evidenceExpiry(now).getTime()).toBe(now.getTime() + 396 * 86400000);
  });
  it("accepts a bounded explicit action extraction", () => {
    expect(validActionExtraction({ title: "Register for race", deadline: "2026-11-26T23:59:00Z", deadlineType: "registration_deadline", category: "sports", urgency: "high", confidence: 0.91, dateExplicit: true, evidencePhrase: "Registration closes November 26" })).toBe(true);
  });
  it("bounds optional action ownership and response metadata", () => {
    expect(validActionExtraction({ title: "Return form", actionType: "respond", responsiblePerson: "Riley", requiresResponse: true, category: "school", urgency: "normal", confidence: 0.8, dateExplicit: true, evidencePhrase: "Please reply" })).toBe(true);
    expect(validActionExtraction({ title: "Return form", actionType: "respond", responsiblePerson: "x".repeat(121), category: "school", urgency: "normal", confidence: 0.8, dateExplicit: true, evidencePhrase: "Please reply" })).toBe(false);
  });
  it("rejects ambiguous, unbounded, or low-quality action output", () => {
    expect(validActionExtraction({ title: "Do it tomorrow", category: "sports", urgency: "high", confidence: 0.9, dateExplicit: false, evidencePhrase: "tomorrow" })).toBe(false);
    expect(validActionExtraction({ title: "x".repeat(241), category: "sports", urgency: "high", confidence: 0.9, dateExplicit: true, evidencePhrase: "explicit date" })).toBe(false);
  });
  it("validates a persisted action lifecycle record", () => {
    expect(validActionItem({ id: "a1", title: "Register", deadline: "2026-11-26T23:59:00Z", deadlineType: "registration_deadline", category: "sports", urgency: "high", confidence: 0.8, dateExplicit: true, evidencePhrase: "closes Nov 26", status: "open", timezone: "America/New_York", sourceMessageId: "m1", extractionVersion: "v1", createdAt: "2026-11-10T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z", expiresAt: "2027-12-11T00:00:00Z" })).toBe(true);
  });
});
