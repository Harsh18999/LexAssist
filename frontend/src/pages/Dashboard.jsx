import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api, formatTime } from "../api/client";

/** Pulsing skeleton block for loading state */
function Skeleton({ width = "100%", height = "1.2rem", style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: "linear-gradient(90deg, var(--bg-elevated) 25%, var(--border) 50%, var(--bg-elevated) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}

function MetricSkeleton() {
  return (
    <div className="metric">
      <Skeleton width="60%" height="0.65rem" style={{ marginBottom: "0.7rem" }} />
      <Skeleton width="45%" height="1.85rem" />
    </div>
  );
}

const METRIC_ICONS = {
  Clients: "👥",
  "Active Cases": "⚖",
  Documents: "📄",
  "AI Queries": "🧠",
  "Pending Hearings": "📅",
  "Case Briefs": "📋",
};

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ctrlRef = useRef(null);

  useEffect(() => {
    // Instant render from cache if available
    const cached = api.dashboardCached();
    if (cached) {
      setD(cached);
      setLoading(false);
    }

    // Use SSE stream for fresh data — updates over cache
    ctrlRef.current = api.dashboardStream(
      (data) => { setD(data); setLoading(false); },
      (err) => {
        // If we already have cached data, don't show error
        if (!d && !cached) setError(err.message);
        setLoading(false);
      }
    );

    return () => ctrlRef.current?.abort();
  }, []);

  const metrics = d
    ? [
        { label: "Clients",          value: d.total_clients },
        { label: "Active Cases",     value: d.active_cases ?? d.total_cases },
        { label: "Documents",        value: d.uploaded_documents },
        { label: "AI Queries",       value: d.ai_queries },
        { label: "Pending Hearings", value: d.pending_hearings },
        { label: "Case Briefs",      value: d.recent_briefs },
      ]
    : Array(6).fill(null);

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .metric-card {
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .metric-card::after {
          content: "";
          position: absolute;
          top: 0; right: 0;
          width: 48px; height: 48px;
          border-radius: 50%;
          background: var(--accent-dim);
          transform: translate(30%, -30%);
        }
        .activity-item {
          transition: background 0.12s ease;
          border-radius: 8px;
          margin: 0 -0.5rem;
          padding: 0.75rem 0.5rem;
        }
        .activity-item:hover { background: var(--accent-dim); }
      `}</style>

      <header className="page-head">
        <h2>Dashboard</h2>
        <p>Your legal intelligence workspace</p>
      </header>

      <div className="quick-actions">
        <Link to="/clients" className="btn btn-primary btn-sm">+ Add Client</Link>
        <Link to="/cases"   className="btn btn-ghost btn-sm">New Case</Link>
        <Link to="/upload"  className="btn btn-ghost btn-sm">Upload Document</Link>
        <Link to="/research" className="btn btn-ghost btn-sm">AI Research</Link>
      </div>

      {error && (
        <div style={{ color: "var(--danger)", marginBottom: "1rem", fontSize: "0.875rem" }}>
          ⚠ {error} — <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* Metrics */}
      <div className="metrics">
        {loading
          ? metrics.map((_, i) => <MetricSkeleton key={i} />)
          : metrics.map((m) => (
              <div key={m.label} className="metric metric-card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.9rem" }}>{METRIC_ICONS[m.label] || "📊"}</span>
                  <div className="label">{m.label}</div>
                </div>
                <div className="value">{m.value ?? "—"}</div>
              </div>
            ))
        }
      </div>

      <div className="grid-2">
        {/* Recent Activity */}
        <div className="glass">
          <h3 style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "1rem" }}>⚡</span> Recent Activity
          </h3>
          {loading ? (
            Array(4).fill(null).map((_, i) => (
              <div key={i} className="list-row" style={{ gap: "0.5rem" }}>
                <Skeleton width="60%" />
                <Skeleton width="20%" />
              </div>
            ))
          ) : d?.recent_activity?.length ? (
            d.recent_activity.map((a, i) => (
              <div key={i} className="activity-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", gap: "1rem" }}>
                <div>
                  <strong style={{ fontSize: "0.88rem" }}>{a.action}</strong>
                  {a.detail && <div className="meta">{a.detail}</div>}
                </div>
                <span className="meta" style={{ whiteSpace: "nowrap" }}>{formatTime(a.timestamp)}</span>
              </div>
            ))
          ) : (
            <p className="meta">No activity yet</p>
          )}
        </div>

        {/* Upcoming Hearings */}
        <div className="glass">
          <h3 style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "1rem" }}>📅</span> Upcoming Hearings
          </h3>
          {loading ? (
            Array(3).fill(null).map((_, i) => (
              <div key={i} className="list-row" style={{ gap: "0.5rem" }}>
                <Skeleton width="55%" />
                <Skeleton width="25%" />
              </div>
            ))
          ) : d?.upcoming_hearings?.length ? (
            d.upcoming_hearings.map((h, i) => (
              <div key={i} className="list-row">
                <div>
                  <strong>{h.title}</strong>
                  <div className="meta">{h.client_name} · {h.court}</div>
                </div>
                <span className="badge">{h.hearing_date}</span>
              </div>
            ))
          ) : (
            <p className="meta">No hearings scheduled</p>
          )}
        </div>
      </div>

      <div className="glass" style={{ marginTop: "1rem" }}>
        <span className="meta">Vector index: </span>
        {loading
          ? <Skeleton width="80px" height="1rem" style={{ display: "inline-block" }} />
          : (
            <>
              <span className={`badge ${d?.index_status === "Active" ? "badge-green" : ""}`}>
                {d?.index_status}
              </span>
              {d?.last_indexed && (
                <span className="meta" style={{ marginLeft: "0.75rem" }}>
                  Last indexed {formatTime(d.last_indexed)}
                </span>
              )}
            </>
          )
        }
      </div>
    </>
  );
}
