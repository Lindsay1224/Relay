import { describe, expect, it } from "vitest";
import { inInferenceWindow, inferredEventId, normalizeInference } from "./inference.js";

describe("email calendar inference", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  it("accepts exact dates without times as all-day events", () => {
    const event = normalizeInference({ title: "School conference", date: "2026-11-10", allDay: true, confidence: 0.8, dateExplicit: true }, "school", "America/New_York", "fp", now);
    expect(event?.allDay).toBe(true);
    expect(event?.status).toBe("pending_confirmation");
  });
  it("rejects relative or malformed dates", () => {
    expect(normalizeInference({ title: "Appointment", date: "tomorrow", confidence: 0.9, dateExplicit: true }, "medical", "America/New_York", "fp", now)).toBeNull();
    expect(normalizeInference({ title: "Appointment", date: "2026-11-10", confidence: 0.9, dateExplicit: false }, "medical", "America/New_York", "fp", now)).toBeNull();
  });
  it("enforces the trailing 30-day and forward 365-day window", () => {
    expect(inInferenceWindow("2026-10-09T12:00:00Z", now)).toBe(false);
    expect(inInferenceWindow("2026-12-01T12:00:00Z", now)).toBe(true);
    expect(inInferenceWindow("2027-11-10T12:00:00Z", now)).toBe(false);
  });
  it("creates deterministic IDs", () => {
    const input = { title: "Practice", startAt: "2026-11-10T17:30:00Z", sourceFingerprint: "fp" };
    expect(inferredEventId(input)).toBe(inferredEventId({ ...input }));
  });
});
