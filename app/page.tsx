"use client";

import { useEffect, useState } from "react";

type View = "connect" | "dashboard";

type ScheduleEvent = {
  day: string;
  date: string;
  time: string;
  icon: string;
  title: string;
  detail: string;
  tag: string;
  style: "sports" | "appointment" | "reminder" | "school";
  evidence?: Array<{ sender: string; subject: string; receivedAt: string; excerpt: string; gmailThreadUrl: string | null }>;
};

function displayEvent(event: Record<string, unknown>): ScheduleEvent {
  const date = new Date(String(event.startAt));
  const allDay = event.allDay === true;
  return { day: date.toLocaleDateString(undefined, { weekday: "short" }), date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), time: allDay ? "All day" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), icon: "✦", title: String(event.title ?? "Family event"), detail: allDay ? "From Gmail" : date.toLocaleDateString(), tag: "Gmail", style: "school", evidence: Array.isArray(event.evidence) ? event.evidence as ScheduleEvent["evidence"] : [] };
}

export default function Home() {
  const [view, setView] = useState<View>("connect");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) setToast("We couldn't connect Gmail. Please try again.");
    const from = new Date();
    const to = new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
    fetch(`/api/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ events: foundEvents }) => {
        setEvents(foundEvents.map(displayEvent));
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
    const poll = window.setInterval(async () => { const status = await fetch("/api/sync-status").then(r => r.ok ? r.json() : null); if (status && !["queued", "processing"].includes(status.state)) { window.clearInterval(poll); setSyncing(false); const from = new Date(), to = new Date(from.getTime() + 60 * 86400000); const found = await fetch(`/api/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`).then(r => r.json()); setEvents((found.events ?? []).map(displayEvent)); notify(status.state === "complete" ? "Sync complete" : "Sync needs attention"); } }, 2500);
  };
  if (view === "dashboard") return <><Dashboard events={events} notify={notify} syncing={syncing} onSync={sync} />{toast && <div className="toast" role="status">{toast}</div>}</>;
  return <><Connect onConnect={connectGmail} />{toast && <div className="toast" role="status">{toast}</div>}</>;
}

function Brand() { return <a className="brand" href="#"><span className="brand-mark">r</span>relay</a>; }

function Connect({ onConnect }: { onConnect: () => void }) {
  return <main className="intro"><nav className="nav"><Brand /><span className="nav-note">Your family, in sync</span></nav><div className="connect-layout"><div className="hero-copy"><p className="eyebrow"><span />A calmer week starts here</p><h1>All their plans.<br /><em>One clear week.</em></h1><p className="hero-text">Relay finds the school notes, team updates, and appointment details already waiting in your inbox—then puts the important parts in one place.</p><button className="gmail-button" onClick={onConnect}><span className="google-g">G</span>Connect Gmail <span className="button-arrow">→</span></button><p className="microcopy">Read-only access · You choose what to share</p></div><Preview /></div><p className="footer-note">Built for the beautiful chaos of family life.</p></main>;
}

function Preview() { return <div className="preview-card"><div className="preview-top"><div><p>Up next</p><strong>Tuesday, Sep 16</strong></div><span className="sparkle">✦</span></div>{[["M", "Soccer practice", "Maya · 5:30 PM", "coral"], ["O", "Dental appointment", "Owen · 3:15 PM", "blue"], ["M", "Library book due", "Maya · Thursday", "yellow"]].map(([initial, title, detail, color]) => <article className={`mini-event ${color}`} key={title}><span className="avatar">{initial}</span><div><b>{title}</b><small>{detail}</small></div><span>›</span></article>)}<div className="preview-foot"><span className="tiny-dot" />Pulled from the details that matter</div></div>; }

function Dashboard({ events, notify, syncing, onSync }: { events: ScheduleEvent[]; notify: (message: string) => void; syncing: boolean; onSync: () => void }) { const highlight = events[0]; return <main className="dashboard"><header className="dash-header"><Brand /><div className="header-right"><button className="text-button" onClick={onSync} disabled={syncing}>{syncing ? "Syncing…" : "Sync Gmail"}</button><span className="inbox-pill"><i />Gmail connected</span><button className="profile" aria-label="Parent profile">L</button></div></header><div className="dashboard-content"><section className="welcome-row"><div><p className="eyebrow">Your inbox, simplified</p><h2>Your family’s week.</h2><p className="subhead">{syncing ? "Reading recent Gmail updates safely…" : "Here’s what Relay found in your recent updates."}</p></div><div className="week-progress"><div className="sun-icon">☀</div><span>Week at a glance</span><strong>{events.length} things ahead</strong></div></section>{highlight && <section className="attention-card"><div className="attention-icon">✦</div><div><p className="eyebrow">Worth a look</p><h3>{highlight.title}</h3><p>{highlight.detail}</p></div></section>}<section className="schedule-section"><div className="section-heading"><div><p className="eyebrow">Your week</p><h3>Family schedule</h3></div><span className="source-note">From {events.length} Gmail updates</span></div>{events.length ? <div className="days-grid">{events.map((event, index) => <div className={`day-column ${index === 0 ? "today" : ""}`} key={`${event.day}-${event.title}`}><div className="day-head"><span>{event.day}</span><b>{event.date}</b></div><article className={`event-card ${event.style}`}><div className="event-time">{event.time}</div><div className="event-body"><span className="event-icon">{event.icon}</span><div><b>{event.title}</b><small>{event.detail}</small></div></div><span className="source-tag">{event.tag}</span></article></div>)}</div> : <p className="empty">{syncing ? "Checking your recent updates…" : "No recent school, team, appointment, or reminder messages were found."}</p>}</section><section className="inbox-section"><div className="section-heading"><div><p className="eyebrow">Recently found</p><h3>From your inbox</h3></div></div><div className="message-list">{events.slice(0, 2).map((event) => <button className="message-row" key={event.title} onClick={() => { const source = event.evidence?.[0]; notify(source ? `${source.sender}: ${source.subject} — ${source.excerpt}` : "No retained source evidence."); }}><span className={`message-icon ${event.style === "sports" ? "sports-icon" : "school-icon"}`}>{event.icon}</span><span><b>{event.title}</b><small>{event.detail}</small></span><time>{event.tag}</time><i>›</i></button>)}</div></section></div></main>; }
