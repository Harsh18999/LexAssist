import { useEffect, useState } from "react";
import { api, formatTime } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [s, setS] = useState(null);

  useEffect(() => {
    api.settings().then(setS);
  }, []);

  return (
    <>
      <header className="page-head">
        <h2>Settings</h2>
        <p>Workspace and system configuration</p>
      </header>
      <div className="grid-2">
        <div className="glass">
          <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Profile</h3>
          <p><strong>{user?.name}</strong></p>
          <p className="meta">{user?.email}</p>
        </div>
        <div className="glass">
          <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>AI Index</h3>
          <p>Status: <span className="badge">{s?.index_status}</span></p>
          <p className="meta" style={{ marginTop: "0.5rem" }}>Chroma DB: {s?.chroma_exists ? "Present" : "Not built"}</p>
        </div>
      </div>
    </>
  );
}
