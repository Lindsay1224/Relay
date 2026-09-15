"use client";

import { useState } from "react";

type View = "connect" | "analyzing" | "dashboard";

const extractionSteps = [
  "Looking through recent school messages…",
  "Spotting team and activity details…",
  "Matching appointments and reminders…",
  "Your week is ready."
];

const events = [
  { day: "TUE", date: "16", time: "5:30 PM", icon: "⚽", title: "Soccer practice", detail: "Maya · North Field", tag: "Team email", style: "sports" },
  { day: "WED", date: "17", time: "3:15 PM", icon: "✚", title: "Dental appointment", detail: "Owen · Bright Smile", tag: "Appointment", style: "appointment" },
  { day: "THU", date: "18", time: "All day", icon: "⌁", title: "Library book due", detail: "Maya · Bring to school", tag: "School note", style: "reminder" },
  { day: "FRI", date: "19", time: "8:20 AM", icon: "✎", title: "Fall picture day", detail: "Owen · Wear blue shirt", tag: "School email", style: "school" }
];

export default function Home() {
  const [view, setView] = useState<View>("connect");
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState("");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const connectGmail = () => {
    setView("analyzing");
    extractionSteps.forEach((_, index) => window.setTimeout(() => setStep(index), index * 780));
    window.setTimeout(() => {
      setView("dashboard");
      notify("Gmail connected — 4 schedule details found");
    }, 3350);
  };

  if (view === "analyzing") return <Analyzing step={step} />;
  if (view === "dashboard") return <Dashboard notify={notify} />;
  return <Connect onConnect={connectGmail} />;
}

function Brand() { return <a className="brand" href="#"><span className="brand-mark">r</span>relay</a>; }

function Connect({ onConnect }: { onConnect: () => void }) {
  return <main className="intro"><nav className="nav"><Brand /><span className="nav-note">Your family, in sync</span></nav><div className="connect-layout"><div className="hero-copy"><p className="eyebrow"><span />A calmer week starts here</p><h1>All their plans.<br /><em>One clear week.</em></h1><p className="hero-text">Relay finds the school notes, team updates, and appointment details already waiting in your inbox—then puts the important parts in one place.</p><button className="gmail-button" onClick={onConnect}><span className="google-g">G</span>Connect Gmail <span className="button-arrow">→</span></button><p className="microcopy">Demo connection · Your inbox stays yours</p></div><Preview /></div><p className="footer-note">Built for the beautiful chaos of family life.</p></main>;
}

function Preview() { return <div className="preview-card"><div className="preview-top"><div><p>Up next</p><strong>Tuesday, Sep 16</strong></div><span className="sparkle">✦</span></div>{[["M", "Soccer practice", "Maya · 5:30 PM", "coral"], ["O", "Dental appointment", "Owen · 3:15 PM", "blue"], ["M", "Library book due", "Maya · Thursday", "yellow"]].map(([initial, title, detail, color]) => <article className={`mini-event ${color}`} key={title}><span className="avatar">{initial}</span><div><b>{title}</b><small>{detail}</small></div><span>›</span></article>)}<div className="preview-foot"><span className="tiny-dot" />Pulled from the details that matter</div></div>; }

function Analyzing({ step }: { step: number }) { return <main className="analyzing" aria-live="polite"><div className="scan-card"><div className="scan-logo"><span className="brand-mark">r</span></div><div className="orbit"><span /><span /><span /></div><p className="eyebrow centered">Reading the room</p><h2>Finding the details<br />that move your week.</h2><p className="scan-status">{extractionSteps[step]}</p><div className="scan-progress"><i style={{ width: `${[28, 53, 78, 100][step]}%` }} /></div><p className="scan-count">{step + 1} of 4 useful updates found</p></div></main>; }

function Dashboard({ notify }: { notify: (message: string) => void }) { return <main className="dashboard"><header className="dash-header"><Brand /><div className="header-right"><span className="inbox-pill"><i />Gmail connected</span><button className="profile" aria-label="Parent profile">L</button></div></header><div className="dashboard-content"><section className="welcome-row"><div><p className="eyebrow">Monday, September 15</p><h2>Good morning, Lindsay.</h2><p className="subhead">Here’s what your family needs to know this week.</p></div><div className="week-progress"><div className="sun-icon">☀</div><span>Week at a glance</span><strong>4 things ahead</strong></div></section><section className="attention-card"><div className="attention-icon">✦</div><div><p className="eyebrow">Worth a look</p><h3>Maya needs cleats for soccer tomorrow</h3><p>The team note mentions practice moves to the North Field at 5:30 PM.</p></div><button className="detail-link" onClick={() => notify("Marked as seen")}>Got it <span>→</span></button></section><section className="schedule-section"><div className="section-heading"><div><p className="eyebrow">Your week</p><h3>Family schedule</h3></div><span className="source-note">From 4 Gmail updates</span></div><div className="days-grid"><div className="day-column"><div className="day-head"><span>MON</span><b>15</b></div><p className="empty">A gentle start</p></div>{events.map((event, index) => <div className={`day-column ${index === 0 ? "today" : ""}`} key={event.day}><div className="day-head"><span>{event.day}</span><b>{event.date}</b></div><article className={`event-card ${event.style}`}><div className="event-time">{event.time}</div><div className="event-body"><span className="event-icon">{event.icon}</span><div><b>{event.title}</b><small>{event.detail}</small></div></div><span className="source-tag">{event.tag}</span></article></div>)}</div></section><section className="inbox-section"><div className="section-heading"><div><p className="eyebrow">Recently found</p><h3>From your inbox</h3></div><button className="text-button" onClick={() => notify("Showing the messages that informed this week")}>View source details</button></div><div className="message-list">{[["✎", "Picture day is Friday", "Oakwood Elementary · Owen should wear blue", "8:03 AM", "school-icon"], ["⚽", "Practice location update", "Northside Soccer · North Field, 5:30 PM", "Yesterday", "sports-icon"]].map(([icon, title, detail, date, tone]) => <button className="message-row" key={title} onClick={() => notify(`Source: ${detail}`)}><span className={`message-icon ${tone}`}>{icon}</span><span><b>{title}</b><small>{detail}</small></span><time>{date}</time><i>›</i></button>)}</div></section></div></main>; }
