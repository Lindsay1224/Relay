import { describe, expect, it } from "vitest";
import { actionId, normalizeAction, resolveRelativeDeadline } from "./action-stage.js";

describe("action extraction stage", () => {
  it("normalizes bounded explicit actions with stable IDs", () => {
    const input = { title: "Register for race", deadline: "2026-11-26T23:59:00Z", deadlineType: "registration_deadline", category: "sports", urgency: "high", confidence: 0.9, dateExplicit: true, evidencePhrase: "Registration closes November 26" };
    const action = normalizeAction(input, "sports", "America/New_York", "m1", "t1", "fingerprint", new Date("2026-11-10T00:00:00Z"));
    expect(action).toMatchObject({ title: "Register for race", status: "open", category: "sports", sourceMessageId: "m1", extractionVersion: "v1" });
    expect(action?.id).toBe(actionId("fingerprint", "Register for race", "2026-11-26T23:59:00Z"));
  });

  it("rejects malformed action output", () => {
    expect(normalizeAction({ title: "Do it tomorrow", category: "sports", urgency: "high", confidence: 0.9, dateExplicit: false, evidencePhrase: "tomorrow" }, "sports", "America/New_York", "m1", "t1", "fp")).toBeNull();
  });

  it("resolves bounded relative deadlines from the received timestamp", () => {
    expect(resolveRelativeDeadline("within 16 days", "2026-11-10T12:00:00Z")).toBe("2026-11-26T12:00:00.000Z");
    const action = normalizeAction({ title: "Register", deadline: "within 16 days", category: "sports", urgency: "high", confidence: 0.8, dateExplicit: false, evidencePhrase: "within 16 days" }, "sports", "America/New_York", "m1", "t1", "fp", new Date("2026-11-10T00:00:00Z"), "2026-11-10T12:00:00Z");
    expect(action?.deadline).toBe("2026-11-26T12:00:00.000Z");
  });
});
