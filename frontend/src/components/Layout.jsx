import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/clients", label: "Clients" },
  { to: "/cases", label: "Cases" },
  { to: "/research", label: "AI Research" },
  { to: "/knowledge", label: "Knowledge Base" },
  { to: "/upload", label: "Upload" },
  { to: "/brief", label: "Case Briefs" },
  { to: "/settings", label: "Settings" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1><span>⚖</span> JurisAI</h1>
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
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill">
            <strong>{user?.name}</strong>
            {user?.email}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: "0.5rem" }} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
