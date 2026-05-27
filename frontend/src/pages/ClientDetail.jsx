import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);

  useEffect(() => {
    api.getClient(id).then(setClient);
  }, [id]);

  if (!client) return <div className="empty">Loading…</div>;

  return (
    <>
      <header className="page-head">
        <Link to="/clients" className="meta">← Clients</Link>
        <h2>{client.name}</h2>
        <p>{client.jurisdiction || "—"} · {client.advocate || "No advocate assigned"}</p>
      </header>
      <div className="grid-2">
        <div className="glass">
          <h3 style={{ fontSize: "1rem" }}>Contact</h3>
          <p className="meta">{client.phone || "—"} · {client.email || "—"}</p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.88rem" }}>{client.address || "—"}</p>
        </div>
        <div className="glass">
          <h3 style={{ fontSize: "1rem" }}>Active Cases</h3>
          {(client.cases || []).map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
              <strong>{c.title}</strong>
              <span className="badge">{c.status}</span>
            </Link>
          ))}
          {!client.cases?.length && <p className="meta">No cases</p>}
        </div>
      </div>
    </>
  );
}
