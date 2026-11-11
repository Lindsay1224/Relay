import { describe, expect, it } from "vitest";
import { validCanonicalMessage } from "./message-models";

describe("canonical message records", () => {
  it("accepts bounded metadata without requiring a body", () => {
    expect(validCanonicalMessage({ id: "m1", gmailMessageId: "m1", threadId: "t1", sender: "School <school@example.com>", subject: "Field trip", receivedAt: "2026-11-10T12:00:00Z", excerpt: "Please return the form.", status: "relevant", relevanceScore: 3, category: "school", categorizationStatus: "complete", extractionVersion: "v1", updatedAt: "2026-11-10T12:01:00Z", expiresAt: "2027-12-11T12:01:00Z" })).toBe(true);
  });
  it("rejects raw-content-shaped or unbounded records", () => {
    expect(validCanonicalMessage({ id: "m1", gmailMessageId: "m1", threadId: "t1", sender: "s", subject: "s", receivedAt: "2026-11-10T12:00:00Z", status: "relevant", body: "raw body", extractionVersion: "v1", updatedAt: "2026-11-10T12:01:00Z", expiresAt: "2027-12-11T12:01:00Z" })).toBe(false);
    expect(validCanonicalMessage({ id: "m1", gmailMessageId: "m1", threadId: "t1", sender: "s", subject: "s", receivedAt: "2026-11-10T12:00:00Z", excerpt: "x".repeat(701), status: "relevant", extractionVersion: "v1", updatedAt: "2026-11-10T12:01:00Z", expiresAt: "2027-12-11T12:01:00Z" })).toBe(false);
  });
});
