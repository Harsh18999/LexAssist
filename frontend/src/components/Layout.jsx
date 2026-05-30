import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { latency } from "../api/client";

const nav = [
  { to: "/",         label: "Dashboard",   icon: "⊞", end: true },
  { to: "/clients",  label: "Clients",     icon: "👥" },
  { to: "/cases",    label: "Cases",       icon: "⚖" },
  { to: "/research", label: "AI Research", icon: "🔍" },
  { to: "/documents",label: "Documents",   icon: "📁" },
  { to: "/upload",   label: "Upload",      icon: "⬆" },
  { to: "/settings", label: "Settings",    icon: "⚙" },
];

/** Polls `latency.last` and shows it as a live "API latency" indicator */
function LatencyBadge() {
  const [ms, setMs] = useState(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (latency.last !== ms) setMs(latency.last);
    }, 500);
    return () => clearInterval(id);
  }, [ms]);

  if (!ms) return null;

  const num = parseFloat(ms);
  const color = num < 200 ? "#16a34a" : num < 600 ? "#ca8a04" : "#ef4444";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.35rem",
      padding: "0.3rem 0.6rem", borderRadius: 6,
      background: "var(--bg)", border: "1px solid var(--border)",
      marginBottom: "0.4rem",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>API</span>
      <span style={{ fontSize: "0.68rem", fontWeight: 700, color, marginLeft: "auto" }}>{ms}</span>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1><span>⚖</span> LexAssist</h1>
          <p>Legal Intelligence Platform</p>
        </div>

        <nav>
          {nav.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span className="nav-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <LatencyBadge />
          <div className="user-pill">
            <strong>{user?.name}</strong>
            {user?.email}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: "100%", marginTop: "0.5rem" }}
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
