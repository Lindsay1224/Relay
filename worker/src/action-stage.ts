import crypto from "node:crypto";
import { ACTION_TYPES, validActionExtraction, type ActionCategory, type ActionItem, type ActionExtractionResult } from "../../lib/action-models.js";

export const ACTION_EXTRACTION_VERSION = "v1";

export function resolveRelativeDeadline(value: string, receivedAt: string) {
  const anchor = Date.parse(receivedAt);
  if (!Number.isFinite(anchor)) return null;
  const normalized = value.trim().toLowerCase();
  const days = normalized.match(/^(?:within|in)\s+(\d{1,3})\s+days?$/)?.[1] ?? (normalized === "tomorrow" ? "1" : normalized === "next week" ? "7" : null);
  if (days) return new Date(anchor + Number(days) * 86400000).toISOString();
  const weekday = normalized.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/)?.[1];
  if (!weekday) return null;
  const target = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(weekday);
  const date = new Date(anchor), delta = (target - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString();
}

export function actionId(sourceFingerprint: string, title: string, deadline?: string) {
  return crypto.createHash("sha256").update(`${sourceFingerprint}:${title}:${deadline ?? ""}`).digest("hex").slice(0, 40);
}

export function normalizeAction(value: unknown, category: string, timezone: string, sourceMessageId: string, sourceThreadId: string, sourceFingerprint: string, now = new Date(), receivedAt?: string): ActionItem | null {
  const candidate = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : null;
  if (candidate && typeof candidate.deadline === "string" && receivedAt && Number.isNaN(Date.parse(candidate.deadline))) {
    const resolved = resolveRelativeDeadline(candidate.deadline, receivedAt);
    if (resolved) { candidate.deadline = resolved; candidate.dateExplicit = true; }
  }
  if (!candidate || !validActionExtraction(candidate)) return null;
  const result = candidate as ActionExtractionResult;
  const normalizedCategory = ["school", "sports", "medical", "home", "bills", "other"].includes(result.category) ? result.category : "other" as ActionCategory;
  const id = actionId(sourceFingerprint, result.title, result.deadline);
  const createdAt = now.toISOString();
  const responsiblePerson = result.responsiblePerson?.replace(/\s+/g, " ").trim().slice(0, 120);
  return {
    id,
    title: result.title.replace(/\s+/g, " ").trim(),
    actionType: result.actionType && ACTION_TYPES.includes(result.actionType) ? result.actionType : "other",
    ...(result.description ? { description: result.description.replace(/\s+/g, " ").trim() } : {}),
    ...(responsiblePerson ? { responsiblePerson } : {}),
    requiresResponse: result.requiresResponse === true,
    ...(result.deadline ? { deadline: result.deadline } : {}),
    ...(result.deadlineType ? { deadlineType: result.deadlineType } : {}),
    ...(result.relatedEventDate ? { relatedEventDate: result.relatedEventDate } : {}),
    timezone,
    category: normalizedCategory,
    urgency: result.urgency,
    confidence: Math.max(0, Math.min(1, result.confidence)),
    status: "open",
    sourceMessageId,
    ...(sourceThreadId ? { sourceThreadId } : {}),
    evidencePhrase: result.evidencePhrase.replace(/\s+/g, " ").trim(),
    extractionVersion: ACTION_EXTRACTION_VERSION,
    extractionModel: process.env.RELAY_GEMINI_MODEL ?? "gemini-2.5-flash-lite",
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(now.getTime() + 396 * 86400000).toISOString(),
  };
}
