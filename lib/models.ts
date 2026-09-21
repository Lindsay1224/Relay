export type SyncState = "idle" | "queued" | "processing" | "complete" | "attention_needed";
export type GmailConnection = { email?: string; tokenCiphertext?: string; wrappedDataKey?: string; kmsKeyVersion?: string; sync?: Record<string, unknown>; migrationState?: string; [key: string]: unknown };
export type RelayEvent = { title: string; startAt: string; endAt?: string; allDay: boolean; timezone: string; sourceFingerprint: string; status: "active" | "needs_review"; [key: string]: unknown };
export type Evidence = { sender: string; subject: string; receivedAt: string; excerpt: string; threadId: string; expiresAt: string };

export function validEvent(value: unknown): value is RelayEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return typeof event.title === "string" && event.title.length > 0 && event.title.length <= 240 && typeof event.startAt === "string" && !Number.isNaN(Date.parse(event.startAt)) && typeof event.allDay === "boolean" && typeof event.timezone === "string" && typeof event.sourceFingerprint === "string";
}

export function cleanExcerpt(value: string) { return value.replace(/\s+/g, " ").trim().slice(0, 700); }
