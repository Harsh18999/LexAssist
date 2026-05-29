import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Skeleton, RowSkeleton, Pagination, EmptyState } from "../components/ui";

const PAGE_SIZE = 10;

export default function Clients() {
  const [data, setData] = useState({ clients: [], total: 0, page: 1, total_pages: 1 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", advocate: "", jurisdiction: "" });
  const [submitting, setSubmitting] = useState(false);
  const debounce = useRef(null);

  function load(s, p) {
    setLoading(true);
    api.clients(s, p, PAGE_SIZE).then((r) => {
      setData({ clients: r.clients || [], total: r.total || 0, page: r.page || p, total_pages: r.total_pages || 1 });
    }).catch(() => {
      setData({ clients: [], total: 0, page: 1, total_pages: 1 });
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      load(search, 1);
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [search]);

  useEffect(() => { load(search, page); }, [page]);

  async function create(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.createClient(form);
      setShowForm(false);
      setForm({ name: "", phone: "", email: "", advocate: "", jurisdiction: "" });
      load(search, page);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      <header className="page-head">
        <h2>Clients</h2>
        <p>Manage client profiles and matters</p>
      </header>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: "0.9rem" }}>🔍</span>
          <input
            className="input"
            style={{ marginBottom: 0, paddingLeft: "2rem" }}
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Client</button>
      </div>

      {showForm && (
        <form className="glass" onSubmit={create} style={{ marginBottom: "1rem" }}>
          <div className="grid-2">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Jurisdiction</label><input className="input" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><span className="spinner" /> Saving…</> : "Save Client"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="glass">
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {loading ? <Skeleton width={80} height="0.75rem" /> : `${data.total} client${data.total !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <RowSkeleton rows={PAGE_SIZE} cols={2} />
        ) : data.clients.length === 0 ? (
          <EmptyState icon="👥" title="No clients yet" subtitle="Create your first client to get started" />
        ) : (
          data.clients.map((c) => (
            <Link key={c.id} to={`/clients/${c.id}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.9rem", flexShrink: 0, fontWeight: 700, color: "var(--muted)",
                }}>
                  {c.name?.[0]?.toUpperCase() || "C"}
                </div>
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>{c.name}</strong>
                  <div className="meta">{c.jurisdiction || "—"} · {c.case_count ?? 0} case{c.case_count !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <span className="badge">View →</span>
            </Link>
          ))
        )}

        <Pagination page={data.page} totalPages={data.total_pages} onPage={setPage} />
      </div>
    </>
  );
}
