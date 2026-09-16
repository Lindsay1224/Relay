export type ScheduleEvent = {
  day: string;
  date: string;
  time: string;
  icon: string;
  title: string;
  detail: string;
  tag: "Team email" | "Appointment" | "School note" | "Reminder";
  style: "sports" | "appointment" | "reminder" | "school";
};

type GmailMessage = { id: string; internalDate?: string; snippet?: string; payload?: { headers?: Array<{ name: string; value: string }> } };

const relevant = /(school|teacher|class|picture day|field trip|library|practice|soccer|baseball|basketball|game|team|appointment|doctor|dentist|reminder|due)/i;

function classify(text: string): Pick<ScheduleEvent, "icon" | "tag" | "style"> {
  if (/(practice|soccer|baseball|basketball|game|team)/i.test(text)) return { icon: "⚽", tag: "Team email", style: "sports" };
  if (/(appointment|doctor|dentist|medical)/i.test(text)) return { icon: "✚", tag: "Appointment", style: "appointment" };
  if (/(due|reminder|bring|deadline)/i.test(text)) return { icon: "⌁", tag: "Reminder", style: "reminder" };
  return { icon: "✎", tag: "School note", style: "school" };
}

function timeFrom(text: string) {
  return text.match(/\b(?:[1-9]|1[0-2])(?::[0-5]\d)?\s?(?:a\.?m\.?|p\.?m\.?)\b/i)?.[0]?.toUpperCase().replace(/\./g, "") ?? "See message";
}

function dayFrom(internalDate?: string) {
  const value = internalDate ? new Date(Number(internalDate)) : new Date();
  return { day: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(value).toUpperCase(), date: String(value.getDate()) };
}

export async function fetchGmailSchedule(accessToken: string): Promise<ScheduleEvent[]> {
  const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=newer_than%3A30d", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!list.ok) throw new Error("Unable to list Gmail messages");
  const { messages = [] } = await list.json() as { messages?: Array<{ id: string }> };
  const details = await Promise.all(messages.slice(0, 25).map(async ({ id }) => {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    return response.ok ? response.json() as Promise<GmailMessage> : null;
  }));

  return details.filter((message): message is GmailMessage => Boolean(message)).map((message) => {
    const headers = Object.fromEntries(message.payload?.headers?.map(({ name, value }) => [name.toLowerCase(), value]) ?? []);
    const subject = headers.subject ?? "Family update";
    const body = `${subject} ${message.snippet ?? ""}`;
    return relevant.test(body) ? { ...dayFrom(message.internalDate), ...classify(body), time: timeFrom(body), title: subject.slice(0, 100), detail: (message.snippet || headers.from || "Details in Gmail").slice(0, 130) } : null;
  }).filter((event): event is ScheduleEvent => Boolean(event)).slice(0, 6);
}
