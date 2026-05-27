import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", advocate: "", jurisdiction: "" });

  function load() {
    api.clients(search).then((r) => setClients(r.clients || []));
  }

  useEffect(() => { load(); }, [search]);

  async function create(e) {
    e.preventDefault();
    await api.createClient(form);
    setShowForm(false);
    setForm({ name: "", phone: "", email: "", advocate: "", jurisdiction: "" });
    load();
  }

  return (
    <>
      <header className="page-head">
        <h2>Clients</h2>
        <p>Manage client profiles and matters</p>
      </header>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <input className="input" style={{ marginBottom: 0, flex: 1 }} placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Client</button>
      </div>

      {showForm && (
        <form className="glass" onSubmit={create}>
          <div className="grid-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Jurisdiction</label><input className="input" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn btn-primary">Save Client</button>
        </form>
      )}

      <div className="glass">
        {clients.length === 0 ? <p className="empty">No clients yet</p> : clients.map((c) => (
          <Link key={c.id} to={`/clients/${c.id}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
            <div>
              <strong>{c.name}</strong>
              <div className="meta">{c.jurisdiction || "—"} · {c.case_count} cases</div>
            </div>
            <span className="badge">View</span>
          </Link>
        ))}
      </div>
    </>
  );
}
