import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatTime } from "../api/client";

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.dashboard().then(setD).catch(console.error);
  }, []);

  if (!d) return <div className="empty">Loading workspace…</div>;

  const metrics = [
    { label: "Clients", value: d.total_clients },
    { label: "Active Cases", value: d.active_cases ?? d.total_cases },
    { label: "Documents", value: d.uploaded_documents },
    { label: "AI Queries", value: d.ai_queries },
    { label: "Pending Hearings", value: d.pending_hearings },
    { label: "Case Briefs", value: d.recent_briefs },
  ];

  return (
    <>
      <header className="page-head">
        <h2>Dashboard</h2>
        <p>Your legal intelligence workspace</p>
      </header>

      <div className="quick-actions">
        <Link to="/clients" className="btn btn-primary btn-sm">+ Add Client</Link>
        <Link to="/cases" className="btn btn-ghost btn-sm">New Case</Link>
        <Link to="/upload" className="btn btn-ghost btn-sm">Upload Document</Link>
        <Link to="/brief" className="btn btn-ghost btn-sm">Generate Brief</Link>
        <Link to="/research" className="btn btn-ghost btn-sm">AI Research</Link>
      </div>

      <div className="metrics">
        {metrics.map((m) => (
          <div key={m.label} className="metric">
            <div className="label">{m.label}</div>
            <div className="value">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="glass">
          <h3 style={{ marginBottom: "0.75rem" }}>Recent Activity</h3>
          {d.recent_activity?.length ? d.recent_activity.map((a, i) => (
            <div key={i} className="list-row">
              <div>
                <strong>{a.action}</strong>
                {a.detail && <div className="meta">{a.detail}</div>}
              </div>
              <span className="meta">{formatTime(a.timestamp)}</span>
            </div>
          )) : <p className="meta">No activity yet</p>}
        </div>
        <div className="glass">
          <h3 style={{ marginBottom: "0.75rem" }}>Upcoming Hearings</h3>
          {d.upcoming_hearings?.length ? d.upcoming_hearings.map((h, i) => (
            <div key={i} className="list-row">
              <div>
                <strong>{h.title}</strong>
                <div className="meta">{h.client_name} · {h.court}</div>
              </div>
              <span className="badge">{h.hearing_date}</span>
            </div>
          )) : <p className="meta">No hearings scheduled</p>}
        </div>
      </div>

      <div className="glass" style={{ marginTop: "1rem" }}>
        <span className="meta">Vector index: </span>
        <span className={`badge ${d.index_status === "Active" ? "badge-green" : ""}`}>{d.index_status}</span>
        {d.last_indexed && <span className="meta" style={{ marginLeft: "0.75rem" }}>Last indexed {formatTime(d.last_indexed)}</span>}
      </div>
    </>
  );
}
