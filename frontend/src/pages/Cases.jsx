import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: "", title: "", court: "", case_number: "", status: "Active" });

  function load() {
    api.cases(search).then((r) => setCases(r.cases || []));
    api.clients().then((r) => setClients(r.clients || []));
  }

  useEffect(() => { load(); }, [search]);

  async function create(e) {
    e.preventDefault();
    await api.createCase(form);
    setShowForm(false);
    load();
  }

  return (
    <>
      <header className="page-head">
        <h2>Cases</h2>
        <p>Case intelligence and document workflows</p>
      </header>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <input className="input" style={{ marginBottom: 0, flex: 1 }} placeholder="Search cases…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Case</button>
      </div>

      {showForm && (
        <form className="glass" onSubmit={create}>
          <label className="label">Client</label>
          <select className="select" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
            <option value="">Select client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="grid-2">
            <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="label">Court</label><input className="input" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn btn-primary">Create Case</button>
        </form>
      )}

      <div className="glass">
        {cases.length === 0 ? <p className="empty">No cases yet — add a client first</p> : cases.map((c) => (
          <Link key={c.id} to={`/cases/${c.id}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
            <div>
              <strong>{c.title}</strong>
              <div className="meta">{c.client_name} · {c.court || "—"}</div>
            </div>
            <span className="badge">{c.status}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
