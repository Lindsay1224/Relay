"use client";

import { useEffect, useState } from "react";

type View = "connect" | "dashboard";

type ScheduleEvent = {
  startAt: string;
  day: string;
  date: string;
  time: string;
  icon: string;
  title: string;
  detail: string;
  tag: string;
  style: "sports" | "appointment" | "reminder" | "school";
  source: string;
  evidence?: Array<{ sender: string; subject: string; receivedAt: string; excerpt: string; gmailThreadUrl: string | null }>;
};

type CandidateMessage = { id: string; sender: string; subject: string; receivedAt: string; excerpt: string; relevanceScore: number; category: "school" | "sports" | "home" | "medical" | "bills"; gmailThreadUrl: string | null };

function calendarRange() { const now = new Date(); return { from: new Date(now.getTime() - 31 * 86400000), to: new Date(now.getTime() + 93 * 86400000) }; }

function displayEvent(event: Record<string, unknown>): ScheduleEvent {
  const date = new Date(String(event.startAt));
  const allDay = event.allDay === true;
  return { startAt: String(event.startAt), day: date.toLocaleDateString(undefined, { weekday: "short" }), date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), time: allDay ? "All day" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), icon: "✦", title: String(event.title ?? "Family event"), detail: allDay ? "From calendar" : date.toLocaleDateString(), tag: String(event.source ?? "Gmail"), source: String(event.source ?? "Gmail"), style: "school", evidence: Array.isArray(event.evidence) ? event.evidence as ScheduleEvent["evidence"] : [] };
}

function monthKey(event: ScheduleEvent) { return new Date(event.startAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }); }

export default function Home() {
  const [view, setView] = useState<View>("connect");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [candidates, setCandidates] = useState<CandidateMessage[]>([]);
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) setToast("We couldn't connect Gmail. Please try again.");
    const from = new Date();
    const to = new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
    const range = calendarRange();
    fetch(`/api/events?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ events: foundEvents }) => {
        setEvents(foundEvents.map(displayEvent));
        fetch("/api/candidates").then((response) => response.ok ? response.json() : { candidates: [] }).then(({ candidates: foundCandidates }) => setCandidates(foundCandidates ?? []));
        setView("dashboard");
        if (params.get("connected") === "1") setToast(foundEvents.length ? `Gmail connected — ${foundEvents.length} events found` : "Gmail connected — ready to sync");
      })
      .catch(() => { /* An unauthenticated visitor sees the connection page. */ });
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const connectGmail = () => {
    window.location.assign("/api/auth/google");
  };

  const sync = async () => {
    setSyncing(true);
    const response = await fetch("/api/sync", { method: "POST" });
    if (!response.ok) { setSyncing(false); notify(response.status === 409 ? "Reconnect Gmail to sync." : "Sync could not start."); return; }
    notify("Gmail sync started");
    const poll = window.setInterval(async () => { const status = await fetch("/api/sync-status").then(r => r.ok ? r.json() : null); if (status && !["queued", "processing"].includes(status.state)) { window.clearInterval(poll); setSyncing(false); const range = calendarRange(); const [found, candidateData] = await Promise.all([fetch(`/api/events?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`).then(r => r.json()), fetch("/api/candidates").then(r => r.json())]); setEvents((found.events ?? []).map(displayEvent)); setCandidates(candidateData.candidates ?? []); notify(status.state === "complete" ? "Sync complete" : "Sync needs attention"); } }, 2500);
  };
  if (view === "dashboard") return <><Dashboard events={events} candidates={candidates} notify={notify} syncing={syncing} onSync={sync} />{toast && <div className="toast" role="status">{toast}</div>}</>;
  return <><Connect onConnect={connectGmail} />{toast && <div className="toast" role="status">{toast}</div>}</>;
}

function Brand() { return <a className="brand" href="#"><span className="brand-mark">r</span>relay</a>; }

function Connect({ onConnect }: { onConnect: () => void }) {
  return <main className="intro"><nav className="nav"><Brand /><span className="nav-note">Your family, in sync</span></nav><div className="connect-layout"><div className="hero-copy"><p className="eyebrow"><span />A calmer week starts here</p><h1>All their plans.<br /><em>One clear week.</em></h1><p className="hero-text">Relay finds the school notes, team updates, and appointment details already waiting in your inbox—then puts the important parts in one place.</p><button className="gmail-button" onClick={onConnect}><span className="google-g">G</span>Connect Gmail <span className="button-arrow">→</span></button><p className="microcopy">Read-only access · You choose what to share</p></div><Preview /></div><p className="footer-note">Built for the beautiful chaos of family life.</p></main>;
}

function Preview() { return <div className="preview-card"><div className="preview-top"><div><p>Up next</p><strong>Tuesday, Sep 16</strong></div><span className="sparkle">✦</span></div>{[["M", "Soccer practice", "Maya · 5:30 PM", "coral"], ["O", "Dental appointment", "Owen · 3:15 PM", "blue"], ["M", "Library book due", "Maya · Thursday", "yellow"]].map(([initial, title, detail, color]) => <article className={`mini-event ${color}`} key={title}><span className="avatar">{initial}</span><div><b>{title}</b><small>{detail}</small></div><span>›</span></article>)}<div className="preview-foot"><span className="tiny-dot" />Pulled from the details that matter</div></div>; }

function CandidateSection({ candidates, notify }: { candidates: CandidateMessage[]; notify: (message: string) => void }) {
  return <section className="candidate-section inbox-section">
    <div className="section-heading"><div><p className="eyebrow">Needs a look</p><h3>Relevant inbox messages</h3></div><span className="source-note">{candidates.length} candidates</span></div>
    {candidates.length ? <div className="message-list">{candidates.map((candidate) => <button className="message-row" key={candidate.id} onClick={() => notify(candidate.gmailThreadUrl ? `${candidate.sender}: ${candidate.subject}` : candidate.excerpt)}><span className="message-icon school-icon">✦</span><span><b>{candidate.subject || "Relevant Gmail message"}</b><small><span className="category-badge">{candidate.category}</span>{candidate.sender} · relevance {candidate.relevanceScore}</small></span><time>{candidate.receivedAt ? new Date(candidate.receivedAt).toLocaleDateString() : "Gmail"}</time><i>›</i></button>)}</div> : <p className="empty candidate-empty">{ "No relevant inbox messages found yet."}</p>}
  </section>;
}

function Dashboard({ events, candidates, notify, syncing, onSync }: { events: ScheduleEvent[]; candidates: CandidateMessage[]; notify: (message: string) => void; syncing: boolean; onSync: () => void }) {
  const highlight = events[0];
  const months = Array.from(new Set(events.map(monthKey)));
  return <main className="dashboard"><header className="dash-header"><Brand /><div className="header-right"><button className="text-button" onClick={onSync} disabled={syncing}>{syncing ? "Syncing…" : "Sync Gmail"}</button><span className="inbox-pill"><i />Gmail connected</span><button className="profile" aria-label="Parent profile">L</button></div></header><div className="dashboard-content"><section className="welcome-row"><div><p className="eyebrow">Your inbox, simplified</p><h2>Your family’s week.</h2><p className="subhead">{syncing ? "Reading recent Gmail updates safely…" : "Here’s what Relay found in your recent updates."}</p></div><div className="week-progress"><div className="sun-icon">☀</div><span>Four-month view</span><strong>{events.length} things ahead</strong></div></section>{highlight && <section className="attention-card"><div className="attention-icon">✦</div><div><p className="eyebrow">Worth a look</p><h3>{highlight.title}</h3><p>{highlight.detail}</p></div></section>}<section className="schedule-section"><div className="section-heading"><div><p className="eyebrow">One month back · three months ahead</p><h3>Family schedule</h3></div><span className="source-note">{events.length} calendar events</span></div>{events.length ? <div className="calendar-grid">{months.map((month) => <div className="month-column" key={month}><div className="month-title">{month}</div>{events.filter((event) => monthKey(event) === month).map((event) => <article className={`event-card ${event.style}`} key={`${event.title}-${event.startAt}`}><div className="event-time">{event.date} · {event.time}</div><div className="event-body"><span className="event-icon">{event.icon}</span><div><b>{event.title}</b><small>{event.detail}</small></div></div><span className="source-tag">{event.tag}</span></article>)}</div>)}</div> : <p className="empty">{syncing ? "Checking your recent updates…" : "No calendar events were found in this window."}</p>}</section><section className="inbox-section"><div className="section-heading"><div><p className="eyebrow">Recently found</p><h3>From your inbox</h3></div></div><div className="message-list">{events.slice(0, 2).map((event) => <button className="message-row" key={event.title} onClick={() => { const source = event.evidence?.[0]; notify(source ? `${source.sender}: ${source.subject} — ${source.excerpt}` : "No retained source evidence."); }}><span className={`message-icon ${event.style === "sports" ? "sports-icon" : "school-icon"}`}>{event.icon}</span><span><b>{event.title}</b><small>{event.detail}</small></span><time>{event.tag}</time><i>›</i></button>)}</div></section><CandidateSection candidates={candidates} notify={notify} /></div></main>;
}
