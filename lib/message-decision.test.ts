import { describe, expect, it } from "vitest";
import { makeMessageDecision, messageDecisionId, validMessageDecision } from "./message-decision";

describe("message decision ledger", () => {
  it("creates a bounded deterministic decision record", () => {
    const decision = makeMessageDecision({ messageId: "m1", threadId: "t1", disposition: "included", sanitizedReason: "included_inbox_message", relevanceScore: 2, policyVersion: "v1", now: new Date("2026-11-12T12:00:00Z") });
    expect(decision.id).toBe(messageDecisionId("m1", "v1"));
    expect(validMessageDecision(decision)).toBe(true);
    expect(decision).not.toHaveProperty("body");
  });

  it("rejects unsafe or unknown dispositions", () => {
    expect(validMessageDecision({ id: "d1", messageId: "m1", disposition: "body", sanitizedReason: "x", policyVersion: "v1", decidedAt: "2026-11-12T12:00:00Z", expiresAt: "2027-12-13T12:00:00Z" })).toBe(false);
  });
});
