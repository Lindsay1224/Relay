import crypto from "node:crypto";
import { evidenceExpiry } from "./policies";

export const MESSAGE_DECISION_DISPOSITIONS = ["included", "excluded", "failed"] as const;
export type MessageDecisionDisposition = typeof MESSAGE_DECISION_DISPOSITIONS[number];

export type MessageDecision = {
  id: string;
  messageId: string;
  threadId?: string;
  disposition: MessageDecisionDisposition;
  sanitizedReason: string;
  relevanceScore?: number;
  policyVersion: string;
  decidedAt: string;
  expiresAt: string;
};

export function messageDecisionId(messageId: string, policyVersion: string) {
  return crypto.createHash("sha256").update(`message-decision:${messageId}:${policyVersion}`).digest("hex").slice(0, 40);
}

export function makeMessageDecision(input: {
  messageId: string;
  threadId?: string;
  disposition: MessageDecisionDisposition;
  sanitizedReason: string;
  relevanceScore?: number;
  policyVersion: string;
  now?: Date;
}): MessageDecision {
  const now = input.now ?? new Date();
  return {
    id: messageDecisionId(input.messageId, input.policyVersion),
    messageId: input.messageId,
    threadId: input.threadId,
    disposition: input.disposition,
    sanitizedReason: input.sanitizedReason.slice(0, 120),
    relevanceScore: input.relevanceScore,
    policyVersion: input.policyVersion,
    decidedAt: now.toISOString(),
    expiresAt: evidenceExpiry(now).toISOString(),
  };
}

const isDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

export function validMessageDecision(value: unknown): value is MessageDecision {
  if (!value || typeof value !== "object") return false;
  const decision = value as Record<string, unknown>;
  return typeof decision.id === "string" && typeof decision.messageId === "string" &&
    MESSAGE_DECISION_DISPOSITIONS.includes(decision.disposition as MessageDecisionDisposition) &&
    typeof decision.sanitizedReason === "string" && decision.sanitizedReason.length <= 120 &&
    typeof decision.policyVersion === "string" && isDate(decision.decidedAt) && isDate(decision.expiresAt) &&
    (decision.relevanceScore === undefined || (typeof decision.relevanceScore === "number" && Number.isFinite(decision.relevanceScore)));
}
