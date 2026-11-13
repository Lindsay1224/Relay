import crypto from "node:crypto";
import { evidenceExpiry } from "./policies";
import type { ActionItem } from "./action-models";
import { EVENT_PROJECTION_VERSION } from "./event-projection";

export function actionEventId(actionId: string, startAt: string) {
  return crypto.createHash("sha256").update(`action:${actionId}:${startAt}`).digest("hex").slice(0, 40);
}

export function confirmedActionEvent(action: ActionItem, now = new Date()) {
  const sourceDate = action.relatedEventDate ?? action.deadline;
  if (!sourceDate || Number.isNaN(Date.parse(sourceDate))) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(sourceDate);
  const startAt = dateOnly ? `${sourceDate}T00:00:00.000Z` : new Date(sourceDate).toISOString();
  const id = actionEventId(action.id, startAt);
  return {
    id,
    title: action.title,
    startAt,
    timezone: action.timezone,
    allDay: dateOnly,
    category: action.category,
    source: "action_confirmed" as const,
    sourceActionId: action.id,
    sourceFingerprint: `action:${action.id}`,
    projectionVersion: EVENT_PROJECTION_VERSION,
    status: "confirmed" as const,
    confidence: Math.min(1, action.confidence + 0.05),
    confirmedAt: now,
    updatedAt: now,
    createdAt: now,
    expiresAt: evidenceExpiry(now),
  };
}
