import crypto from "node:crypto";

export const INFERENCE_VERSION = "v1";
export const INFERENCE_CATEGORIES = ["school", "sports", "medical", "home", "bills", "other"] as const;
export type InferenceCategory = typeof INFERENCE_CATEGORIES[number];
export type InferredCandidate = { title: string; date: string; startTime?: string; endTime?: string; allDay?: boolean; timezone?: string; location?: string; confidence: number; dateExplicit: boolean; evidencePhrase?: string };
export type NormalizedInference = { title: string; startAt: string; endAt?: string; allDay: boolean; timezone: string; category: InferenceCategory; confidence: number; source: "email_inferred"; status: "pending_confirmation"; evidencePhrase: string; sourceFingerprint: string };

export function inferenceWindow(now = new Date()) { return { from: now.getTime() - 30 * 86400000, to: now.getTime() + 365 * 86400000 }; }
export function inInferenceWindow(value: string, now = new Date()) { const time = Date.parse(value); const range = inferenceWindow(now); return Number.isFinite(time) && time >= range.from && time < range.to; }
function isoDate(value: string) { const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[1]}-${match[2]}-${match[3]}` : null; }
export function normalizeInference(candidate: InferredCandidate, category: string, timezone: string, sourceFingerprint: string, now = new Date()): NormalizedInference | null {
  if (!candidate.dateExplicit || typeof candidate.title !== "string" || !candidate.title.trim()) return null;
  const normalizedCategory = INFERENCE_CATEGORIES.includes(category as InferenceCategory) ? category as InferenceCategory : "other";
  const date = isoDate(String(candidate.date)); if (!date) return null;
  const allDay = candidate.allDay === true || !candidate.startTime;
  const time = String(candidate.startTime ?? "").match(/^(\d{2}:\d{2})(?::(\d{2}))?$/);
  const startAt = allDay ? `${date}T00:00:00.000Z` : `${date}T${time?.[1] ?? ""}:${time?.[2] ?? "00"}Z`;
  if (Number.isNaN(Date.parse(startAt)) || !inInferenceWindow(startAt, now)) return null;
  const endTime = String(candidate.endTime ?? "").match(/^(\d{2}:\d{2})(?::(\d{2}))?$/);
  const endAt = !allDay && endTime ? `${date}T${endTime[1]}:${endTime[2] ?? "00"}Z` : undefined;
  return { title: candidate.title.replace(/\s+/g, " ").trim().slice(0, 240), startAt, ...(endAt ? { endAt } : {}), allDay, timezone, category: normalizedCategory, confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)), source: "email_inferred", status: "pending_confirmation", evidencePhrase: String(candidate.evidencePhrase ?? "").replace(/\s+/g, " ").trim().slice(0, 240), sourceFingerprint };
}
export function inferredEventId(event: Pick<NormalizedInference, "sourceFingerprint" | "title" | "startAt">) { return crypto.createHash("sha256").update(`${event.sourceFingerprint}:${event.title}:${event.startAt}`).digest("hex").slice(0, 40); }
