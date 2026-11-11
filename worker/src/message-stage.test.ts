import { describe, expect, it } from "vitest";
import { mimeText, sanitizeHtml, scoreRelevance, type Part } from "./message-stage.js";

describe("message normalization stage", () => {
  it("prefers plain text while traversing nested MIME parts", () => {
    const part: Part = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: Buffer.from("<p>HTML fallback</p>").toString("base64url") } },
        { mimeType: "text/plain", body: { data: Buffer.from("Plain schedule text").toString("base64url") } },
      ],
    };
    const result = mimeText(part);
    expect(result.plain).toContain("Plain schedule text");
    expect(result.html).toContain("HTML fallback");
  });

  it("removes executable and presentation markup from HTML fallback", () => {
    expect(sanitizeHtml("<style>.x{display:none}</style><p>Practice</p><script>alert(1)</script>")).toBe("Practice");
  });
});

describe("deterministic relevance stage", () => {
  it("excludes non-schedule content before candidate scoring", () => {
    expect(scoreRelevance("Order confirmation", "store@example.com", "Your appointment is tomorrow")).toEqual({ score: 0, reason: "excluded_non_schedule" });
  });

  it("marks messages with at least two schedule signals as candidates", () => {
    const result = scoreRelevance("School practice", "coach@example.com", "Riley has practice at 5:30PM");
    expect(result.reason).toBe("candidate");
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("adds three points for a calendar attachment", () => {
    expect(scoreRelevance("Hello", "family@example.com", "A note", true)).toEqual({ score: 3, reason: "candidate" });
  });
});
