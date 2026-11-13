import { describe, expect, it } from "vitest";
import { fetchMetadataWithRetry, mapBounded, resolveLatestMessages } from "./gmail-plan.js";

describe("Gmail planning safeguards", () => {
  it("reuses reliable records and keeps the newest message per thread", async () => {
    let metadataCalls = 0;
    const result = await resolveLatestMessages(
      [{ id: "old", threadId: "t1" }, { id: "new", threadId: "t1" }, { id: "other", threadId: "t2" }],
      new Map([["old", { id: "old", threadId: "t1", receivedAt: "2026-11-12T09:00:00Z" }]]),
      async (ref) => { metadataCalls += 1; return { id: ref.id, threadId: ref.threadId, receivedAt: ref.id === "new" ? "2026-11-12T10:00:00Z" : "2026-11-12T08:00:00Z" }; },
      2,
    );
    expect(metadataCalls).toBe(2);
    expect(result.map((message) => message.id).sort()).toEqual(["new", "other"]);
  });

  it("never exceeds the configured concurrency", async () => {
    let active = 0;
    let peak = 0;
    await mapBounded([1, 2, 3, 4, 5, 6], 2, async (value) => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, value)); active -= 1; return value; });
    expect(peak).toBe(2);
  });

  it("retries rate limits with bounded backoff", async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const response = await fetchMetadataWithRetry({ id: "m1", threadId: "t1" }, async () => { attempts += 1; return attempts < 3 ? new Response("", { status: 429 }) : new Response(JSON.stringify({ id: "m1", threadId: "t1", internalDate: "1794484800000" }), { status: 200, headers: { "Content-Type": "application/json" } }); }, async (milliseconds) => { sleeps.push(milliseconds); });
    expect(response.id).toBe("m1");
    expect(attempts).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it("fails safely after persistent rate limiting", async () => {
    await expect(fetchMetadataWithRetry({ id: "m1", threadId: "t1" }, async () => new Response("", { status: 429 }), async () => {}, 2)).rejects.toThrow("Gmail metadata rate limited");
  });
});
