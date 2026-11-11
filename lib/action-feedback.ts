import type { ActionItem } from "./action-models";

export const ACTION_FEEDBACK_TYPES = ["confirm", "edit", "snooze", "complete", "dismiss"] as const;
export type ActionFeedbackType = typeof ACTION_FEEDBACK_TYPES[number];

export function feedbackUpdate(action: ActionItem, feedback: ActionFeedbackType, now = new Date(), fields: Record<string, unknown> = {}) {
  const update: Record<string, unknown> = { updatedAt: now };
  if (feedback === "confirm") { update.confidence = Math.min(1, action.confidence + 0.1); update.status = "open"; update.confirmedAt = now; }
  if (feedback === "complete") { update.status = "completed"; update.completedAt = now; }
  if (feedback === "dismiss") { update.status = "dismissed"; update.confidence = Math.max(0, action.confidence - 0.15); update.dismissedAt = now; }
  if (feedback === "snooze") { update.status = "snoozed"; update.snoozedUntil = new Date(now.getTime() + 86400000); }
  if (feedback === "edit") Object.assign(update, fields);
  return update;
}
