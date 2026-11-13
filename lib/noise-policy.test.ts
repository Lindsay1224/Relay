import { describe, expect, it } from "vitest";
import { evaluateNoise, NOISE_POLICY_VERSION } from "./noise-policy";

describe("versioned noise policy", () => {
  it("hard-excludes configured non-schedule terms before scoring", () => {
    const decision = evaluateNoise("Order confirmation", "store@example.com", "Your appointment is tomorrow");
    expect(decision).toMatchObject({ disposition: "excluded", sanitizedReason: "excluded_non_schedule", score: 0, policyVersion: NOISE_POLICY_VERSION });
    expect(decision.matchedSignals).toEqual(["excluded:order confirmation"]);
  });

  it("does not treat unsubscribe as an exclusion", () => {
    expect(evaluateNoise("Update", "sender@example.com", "Please unsubscribe if needed").disposition).toBe("needs_review");
  });

  it("returns safe signal labels and attachment scoring", () => {
    const decision = evaluateNoise("School practice", "coach@example.com", "Riley has practice at 5:30PM", true);
    expect(decision.disposition).toBe("included");
    expect(decision.score).toBeGreaterThanOrEqual(5);
    expect(decision.matchedSignals).not.toContain("Riley");
    expect(decision.matchedSignals).toContain("calendar_attachment");
  });
});
