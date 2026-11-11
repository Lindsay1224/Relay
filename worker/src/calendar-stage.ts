import crypto from "node:crypto";

export type CalendarEvent = { title: string; startAt: string; endAt?: string; allDay: boolean; timezone: string; sourceFingerprint: string; calendarUid: string; recurrenceId?: string; status: "active" | "cancelled" };
function unfold(input: string) { return input.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).filter(Boolean); }
function unescapeIcs(value: string) { return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim(); }
function icsDate(raw: string, timezone: string) {
  const allDay = /^\d{8}$/.test(raw); if (allDay) return { value: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00.000Z`, allDay };
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/); if (!match) return null;
  const [, year, month, day, hour, minute, second, zulu] = match, wall = `${year}-${month}-${day}T${hour}:${minute}:${second}.000`;
  if (zulu) return { value: `${wall}Z`, allDay };
  const guess = new Date(`${wall}Z`), parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(guess);
  const get = (name: string) => Number(parts.find((part) => part.type === name)?.value ?? 0), represented = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return { value: new Date(guess.getTime() + (guess.getTime() - represented)).toISOString(), allDay };
}
function expandRecurrence(event: CalendarEvent, rule?: string) {
  if (!rule) return [event];
  const values = Object.fromEntries(rule.split(";").map((part) => part.split("=")).filter((pair) => pair.length === 2).map(([key, value]) => [key.toUpperCase(), value])), freq = values.FREQ, interval = Math.max(1, Number(values.INTERVAL ?? 1)), count = Math.min(200, Number(values.COUNT ?? 200));
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY"].includes(freq)) return [event];
  const until = values.UNTIL ? Date.parse(values.UNTIL.replace(/^(\d{8})$/, "$1T235959Z")) : Number.POSITIVE_INFINITY, result: CalendarEvent[] = [], start = Date.parse(event.startAt), duration = event.endAt ? Date.parse(event.endAt) - start : 0;
  for (let index = 0; index < count; index += 1) { const date = new Date(start); if (freq === "DAILY") date.setUTCDate(date.getUTCDate() + index * interval); if (freq === "WEEKLY") date.setUTCDate(date.getUTCDate() + index * interval * 7); if (freq === "MONTHLY") date.setUTCMonth(date.getUTCMonth() + index * interval); if (date.getTime() > until || date.getTime() > Date.now() + 93 * 86400000) break; result.push({ ...event, startAt: date.toISOString(), ...(duration > 0 ? { endAt: new Date(date.getTime() + duration).toISOString() } : {}), recurrenceId: date.toISOString() }); }
  return result.length ? result : [event];
}
export function parseIcs(input: string, timezone: string, fingerprint: string): CalendarEvent[] {
  const lines = unfold(input), blocks: string[][] = [], current: string[] = [];
  for (const line of lines) { if (line === "BEGIN:VEVENT") current.length = 0; if (current.length || line === "BEGIN:VEVENT") current.push(line); if (line === "END:VEVENT" && current.length) { blocks.push([...current]); current.length = 0; } }
  const output: CalendarEvent[] = [];
  for (const block of blocks) { const fields = new Map<string, { params: string; value: string }>(); for (const line of block) { const colon = line.indexOf(":"); if (colon < 0) continue; const key = line.slice(0, colon), value = unescapeIcs(line.slice(colon + 1)), [name, ...params] = key.split(";"); fields.set(name.toUpperCase(), { params: params.join(";"), value }); } const startField = fields.get("DTSTART"), title = startField && fields.get("SUMMARY")?.value, uid = fields.get("UID")?.value ?? `${fingerprint}:${title ?? "event"}`; if (!startField || !title) continue; const start = icsDate(startField.value, timezone); if (!start) continue; const end = fields.get("DTEND") ? icsDate(fields.get("DTEND")!.value, timezone) : null, status = fields.get("STATUS")?.value.toLowerCase() === "cancelled" ? "cancelled" : "active"; output.push(...expandRecurrence({ title: title.slice(0, 240), startAt: start.value, ...(end ? { endAt: end.value } : {}), allDay: start.allDay, timezone, sourceFingerprint: fingerprint, calendarUid: uid, ...(fields.get("RECURRENCE-ID") ? { recurrenceId: fields.get("RECURRENCE-ID")!.value } : {}), status }, fields.get("RRULE")?.value)); }
  return output;
}
export function calendarEventId(event: Pick<CalendarEvent, "sourceFingerprint" | "calendarUid" | "recurrenceId" | "startAt">) { return crypto.createHash("sha256").update(`${event.sourceFingerprint}:${event.calendarUid}:${event.recurrenceId ?? event.startAt}`).digest("hex").slice(0, 40); }
