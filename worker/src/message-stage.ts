export type Part = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: Part[] };
export type Message = { id: string; threadId: string; internalDate: string; payload?: Part & { headers?: Array<{ name?: string; value?: string }> } };
import { evaluateNoise } from "../../lib/noise-policy.js";

const b64 = (value?: string) => value ? Buffer.from(value, "base64url").toString("utf8") : "";
export const header = (headers: Array<{ name?: string; value?: string }> | undefined, name: string) => headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
export function sanitizeHtml(value: string) { return value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
export function mimeText(part?: Part): { plain: string; html: string; ics: string[] } {
  if (!part) return { plain: "", html: "", ics: [] };
  const children = (part.parts ?? []).map(mimeText), own = b64(part.body?.data);
  return { plain: (part.mimeType === "text/plain" ? own : "") + children.map((child) => child.plain).join("\n"), html: (part.mimeType === "text/html" ? own : "") + children.map((child) => child.html).join("\n"), ics: [...((part.mimeType === "text/calendar" || /\.ics$/i.test(part.filename ?? "")) ? [own] : []), ...children.flatMap((child) => child.ics)] };
}

export function scoreRelevance(subject: string, sender: string, text: string, hasCalendarAttachment = false) {
  const decision = evaluateNoise(subject, sender, text, hasCalendarAttachment);
  return { score: decision.score, reason: decision.sanitizedReason === "excluded_non_schedule" ? "excluded_non_schedule" as const : decision.sanitizedReason === "included_inbox_message" ? "candidate" as const : "insufficient_schedule_signals" as const };
}
