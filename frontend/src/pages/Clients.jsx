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

  // Edit state
  const [editClient, setEditClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

  function openEdit(c, e) {
    e.stopPropagation();
    setEditClient(c);
    setEditForm({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      advocate: c.advocate || "",
      jurisdiction: c.jurisdiction || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editSubmitting) return;
    setEditSubmitting(true);
    try {
      await api.updateClient(editClient.id, editForm);
      setEditClient(null);
      load(search, page);
    } catch (err) {
      alert(err.message);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(c, e) {
    e.stopPropagation();
    const confirmed = confirm(
      c.case_count > 0
        ? `"${c.name}" has ${c.case_count} case(s). Delete client AND all their cases?`
        : `Delete client "${c.name}"?`
    );
    if (!confirmed) return;
    setDeletingId(c.id);
    try {
      await api.deleteClient(c.id, c.case_count > 0);
      load(search, page);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .client-list-row { display: flex; align-items: center; gap: 0.5rem; }
        .client-list-row-link { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: inherit; }
        .client-row-actions { opacity: 0; transition: opacity 0.15s; display: flex; gap: 4px; }
        .client-list-row:hover .client-row-actions { opacity: 1; }
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(2px);
        }
        .modal-box {
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 0.9rem; padding: 1.5rem;
          width: min(480px, calc(100vw - 2rem));
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
          animation: modalIn 0.18s ease;
        }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

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
            <div key={c.id} className="list-row client-list-row">
              <Link to={`/clients/${c.id}`} className="client-list-row-link">
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
                <span className="badge" style={{ marginLeft: "auto" }}>View →</span>
              </Link>

              <div className="client-row-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  title="Edit client"
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                  onClick={(e) => openEdit(c, e)}
                >
                  ✏ Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Delete client"
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#ef4444" }}
                  disabled={deletingId === c.id}
                  onClick={(e) => handleDelete(c, e)}
                >
                  {deletingId === c.id ? <span className="spinner" /> : "✕ Delete"}
                </button>
              </div>
            </div>
          ))
        )}

        <Pagination page={data.page} totalPages={data.total_pages} onPage={setPage} />
      </div>

      {/* Edit Modal */}
      {editClient && (
        <div className="modal-overlay" onClick={() => setEditClient(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Edit Client</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditClient(null)}>✕</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="grid-2">
                <div>
                  <label className="label">Name *</label>
                  <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Jurisdiction</label>
                  <input className="input" value={editForm.jurisdiction} onChange={(e) => setEditForm({ ...editForm, jurisdiction: e.target.value })} />
                </div>
                <div>
                  <label className="label">Advocate</label>
                  <input className="input" value={editForm.advocate} onChange={(e) => setEditForm({ ...editForm, advocate: e.target.value })} />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? <><span className="spinner" /> Saving…</> : "Save Changes"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditClient(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
