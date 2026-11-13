import { describe, expect, it } from "vitest";
import { rankMessage } from "./attention-ranking";

describe("attention ranking", () => {
  it("puts open actions first", () => {
    expect(rankMessage({ relevanceScore: 1, hasOpenAction: true })).toEqual({ attentionTier: "action_required", attentionRank: 400 });
  });

  it("ranks calendar candidates above ordinary relevant messages", () => {
    expect(rankMessage({ relevanceScore: 2, hasCalendarCandidate: true }).attentionRank).toBeGreaterThan(rankMessage({ relevanceScore: 4 }).attentionRank);
  });

  it("lowers, rather than excludes, low-signal messages", () => {
    expect(rankMessage({ relevanceScore: 0 })).toEqual({ attentionTier: "low_priority", attentionRank: 100 });
  });
});
