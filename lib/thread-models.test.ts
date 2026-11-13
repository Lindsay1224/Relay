import { describe, expect, it } from "vitest";
import { newestPerThread } from "./thread-models";

describe("thread normalization", () => {
  it("keeps only the newest message for each thread", () => {
    const records = newestPerThread([
      { id: "old", threadId: "t1", receivedAt: "2026-11-12T09:00:00Z" },
      { id: "new", threadId: "t1", receivedAt: "2026-11-12T10:00:00Z" },
      { id: "other", threadId: "t2", receivedAt: "2026-11-12T08:00:00Z" },
    ]);
    expect(records.map((record) => record.id).sort()).toEqual(["new", "other"]);
  });

  it("uses a stable ID tie-breaker", () => {
    expect(newestPerThread([
      { id: "a", threadId: "t1", receivedAt: "2026-11-12T09:00:00Z" },
      { id: "b", threadId: "t1", receivedAt: "2026-11-12T09:00:00Z" },
    ])[0].id).toBe("b");
  });
});
