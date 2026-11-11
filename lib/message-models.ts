import { ACTION_CATEGORIES, type ActionCategory } from "./action-models";

export const MESSAGE_STATUSES = ["relevant", "skipped", "failed"] as const;
export type MessageStatus = typeof MESSAGE_STATUSES[number];
export type CanonicalMessage = {
  id: string;
  gmailMessageId: string;
  threadId: string;
  sender: string;
  subject: string;
  receivedAt: string;
  excerpt?: string;
  status: MessageStatus;
  sanitizedReason?: string;
  relevanceScore?: number;
  category?: ActionCategory;
  categorizationStatus?: "pending" | "complete" | "failed";
  extractionVersion: string;
  categorizationVersion?: string;
  updatedAt: string;
  expiresAt: string;
};

const isDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
export function validCanonicalMessage(value: unknown): value is CanonicalMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (["body", "rawBody", "mime", "rawMime", "attachments", "accessToken", "refreshToken", "tokenCiphertext"].some((key) => key in message)) return false;
  return typeof message.id === "string" && typeof message.gmailMessageId === "string" && typeof message.threadId === "string" &&
    typeof message.sender === "string" && message.sender.length <= 500 && typeof message.subject === "string" && message.subject.length <= 500 &&
    isDate(message.receivedAt) && MESSAGE_STATUSES.includes(message.status as MessageStatus) &&
    (message.excerpt === undefined || (typeof message.excerpt === "string" && message.excerpt.length <= 700)) &&
    (message.relevanceScore === undefined || (typeof message.relevanceScore === "number" && Number.isFinite(message.relevanceScore))) &&
    (message.category === undefined || ACTION_CATEGORIES.includes(message.category as ActionCategory)) &&
    (message.categorizationStatus === undefined || ["pending", "complete", "failed"].includes(String(message.categorizationStatus))) &&
    typeof message.extractionVersion === "string" && isDate(message.updatedAt) && isDate(message.expiresAt);
}
