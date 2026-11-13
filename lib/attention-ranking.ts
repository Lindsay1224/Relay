export const ATTENTION_TIERS = ["action_required", "calendar_candidate", "important", "low_priority"] as const;
export type AttentionTier = typeof ATTENTION_TIERS[number];

export function rankMessage(input: { relevanceScore?: number; hasOpenAction?: boolean; hasCalendarCandidate?: boolean }) {
  if (input.hasOpenAction) return { attentionTier: "action_required" as const, attentionRank: 400 };
  if (input.hasCalendarCandidate) return { attentionTier: "calendar_candidate" as const, attentionRank: 300 };
  if (Number(input.relevanceScore ?? 0) >= 2) return { attentionTier: "important" as const, attentionRank: 200 };
  return { attentionTier: "low_priority" as const, attentionRank: 100 };
}
