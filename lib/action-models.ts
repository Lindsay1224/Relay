import { MAX_ACTION_DESCRIPTION_LENGTH, MAX_ACTION_TITLE_LENGTH, MAX_EVIDENCE_LENGTH } from "./policies";

export const ACTION_CATEGORIES = ["school", "sports", "medical", "home", "bills", "other"] as const;
export type ActionCategory = typeof ACTION_CATEGORIES[number];
export const ACTION_STATUSES = ["open", "snoozed", "completed", "dismissed", "expired"] as const;
export type ActionStatus = typeof ACTION_STATUSES[number];
export const ACTION_URGENCIES = ["low", "normal", "high", "urgent"] as const;
export type ActionUrgency = typeof ACTION_URGENCIES[number];
export const ACTION_DEADLINE_TYPES = ["registration_deadline", "response_deadline", "appointment", "event", "other"] as const;
export type ActionDeadlineType = typeof ACTION_DEADLINE_TYPES[number];

export type ActionItem = {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  deadlineType?: ActionDeadlineType;
  relatedEventDate?: string;
  timezone: string;
  category: ActionCategory;
  urgency: ActionUrgency;
  confidence: number;
  status: ActionStatus;
  snoozedUntil?: string;
  sourceMessageId: string;
  sourceThreadId?: string;
  evidencePhrase: string;
  extractionVersion: string;
  extractionModel?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type ActionEvidence = {
  sender: string;
  subject: string;
  receivedAt: string;
  excerpt: string;
  threadId?: string;
  expiresAt: string;
};

export type ActionFeedback = {
  id: string;
  targetId: string;
  feedbackType: "confirm" | "edit" | "snooze" | "complete" | "dismiss";
  originalValues?: Record<string, unknown>;
  correctedValues?: Record<string, unknown>;
  createdAt: string;
};

export type ActionExtractionResult = {
  title: string;
  description?: string;
  deadline?: string;
  deadlineType?: ActionDeadlineType;
  relatedEventDate?: string;
  category: ActionCategory;
  urgency: ActionUrgency;
  confidence: number;
  dateExplicit: boolean;
  evidencePhrase: string;
};

const isDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isEnum = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => typeof value === "string" && values.includes(value);

export function validActionExtraction(value: unknown): value is ActionExtractionResult {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  return typeof action.title === "string" && action.title.trim().length > 0 && action.title.length <= MAX_ACTION_TITLE_LENGTH &&
    (action.description === undefined || (typeof action.description === "string" && action.description.length <= MAX_ACTION_DESCRIPTION_LENGTH)) &&
    (action.deadline === undefined || isDate(action.deadline)) && (action.relatedEventDate === undefined || isDate(action.relatedEventDate)) &&
    (action.deadlineType === undefined || isEnum(ACTION_DEADLINE_TYPES, action.deadlineType)) && isEnum(ACTION_CATEGORIES, action.category) &&
    isEnum(ACTION_URGENCIES, action.urgency) && typeof action.confidence === "number" && Number.isFinite(action.confidence) && action.confidence >= 0 && action.confidence <= 1 &&
    action.dateExplicit === true && typeof action.evidencePhrase === "string" && action.evidencePhrase.trim().length > 0 && action.evidencePhrase.length <= MAX_EVIDENCE_LENGTH;
}

export function validActionItem(value: unknown): value is ActionItem {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  return typeof action.id === "string" && validActionExtraction({ ...action, dateExplicit: true }) && isEnum(ACTION_STATUSES, action.status) && typeof action.timezone === "string" && typeof action.sourceMessageId === "string" && typeof action.extractionVersion === "string" && isDate(action.createdAt) && isDate(action.updatedAt) && isDate(action.expiresAt);
}
