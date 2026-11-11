import crypto from "node:crypto";
import { validActionExtraction, type ActionCategory, type ActionItem, type ActionExtractionResult } from "../../lib/action-models.js";

export const ACTION_EXTRACTION_VERSION = "v1";

export function actionId(sourceFingerprint: string, title: string, deadline?: string) {
  return crypto.createHash("sha256").update(`${sourceFingerprint}:${title}:${deadline ?? ""}`).digest("hex").slice(0, 40);
}

export function normalizeAction(value: unknown, category: string, timezone: string, sourceMessageId: string, sourceThreadId: string, sourceFingerprint: string, now = new Date()): ActionItem | null {
  if (!validActionExtraction(value)) return null;
  const result = value as ActionExtractionResult;
  const normalizedCategory = ["school", "sports", "medical", "home", "bills", "other"].includes(result.category) ? result.category : "other" as ActionCategory;
  const id = actionId(sourceFingerprint, result.title, result.deadline);
  const createdAt = now.toISOString();
  return {
    id,
    title: result.title.replace(/\s+/g, " ").trim(),
    ...(result.description ? { description: result.description.replace(/\s+/g, " ").trim() } : {}),
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
