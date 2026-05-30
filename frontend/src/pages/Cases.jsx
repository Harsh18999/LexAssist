import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Skeleton, RowSkeleton, Pagination, EmptyState } from "../components/ui";

const PAGE_SIZE = 10;

const STATUS_COLOR = {
  Active:   { bg: "rgba(22,163,74,0.1)",  color: "#16a34a" },
  Closed:   { bg: "rgba(100,116,139,0.1)", color: "#64748b" },
  Pending:  { bg: "rgba(234,179,8,0.1)",   color: "#ca8a04" },
  Stayed:   { bg: "rgba(239,68,68,0.1)",   color: "#ef4444" },
};

export default function Cases() {
  const [data, setData] = useState({ cases: [], total: 0, page: 1, total_pages: 1 });
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: "", title: "", court: "", case_number: "", status: "Active" });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const debounce = useRef(null);

  // Load clients once (for the dropdown)
  useEffect(() => {
    api.clients("", 1, 100).then((r) => setClients(r.clients || []));
  }, []);

  function load(s, p) {
    setLoading(true);
    api.cases(s, "", p, PAGE_SIZE).then((r) => {
      setData({ cases: r.cases || [], total: r.total || 0, page: r.page || p, total_pages: r.total_pages || 1 });
    }).catch(() => setData({ cases: [], total: 0, page: 1, total_pages: 1 }))
    .finally(() => setLoading(false));
  }

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(search, 1); }, 300);
    return () => clearTimeout(debounce.current);
  }, [search]);

  useEffect(() => { load(search, page); }, [page]);

  async function create(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const newCase = await api.createCase(form);
      setShowForm(false);
      setForm({ client_id: "", title: "", court: "", case_number: "", status: "Active" });
      load(search, page);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(c, e) {
    e.stopPropagation();
    if (!confirm(`Delete case "${c.title}"? This will also remove notes and timeline.`)) return;
    setDeletingId(c.id);
    try {
      await api.deleteCase(c.id);
      load(search, page);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const statusStyle = (s) => STATUS_COLOR[s] || { bg: "var(--accent-dim)", color: "var(--muted)" };

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .case-list-row { display: flex; align-items: center; gap: 0.5rem; }
        .case-list-row-link { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: inherit; }
        .case-row-actions { opacity: 0; transition: opacity 0.15s; display: flex; gap: 4px; align-items: center; }
        .case-list-row:hover .case-row-actions { opacity: 1; }
      `}</style>

      <header className="page-head">
        <h2>Cases</h2>
        <p>Case intelligence and document workflows</p>
      </header>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: "0.9rem" }}>⚖</span>
          <input
            className="input"
            style={{ marginBottom: 0, paddingLeft: "2rem" }}
            placeholder="Search cases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Case</button>
      </div>

      {showForm && (
        <form className="glass" onSubmit={create} style={{ marginBottom: "1rem" }}>
          <label className="label">Client *</label>
          <select className="select" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
            <option value="">Select client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="grid-2">
            <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="label">Court</label><input className="input" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} /></div>
            <div><label className="label">Case No.</label><input className="input" value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value })} /></div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["Active", "Closed", "Pending", "Stayed"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><span className="spinner" />Creating…</> : "Create Case"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="glass">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {loading ? <Skeleton width={80} height="0.75rem" /> : `${data.total} case${data.total !== 1 ? "s" : ""}`}
          </div>
        </div>

        {loading ? (
          <RowSkeleton rows={PAGE_SIZE} cols={2} />
        ) : data.cases.length === 0 ? (
          <EmptyState icon="⚖" title="No cases yet" subtitle="Add a client first, then create a case" />
        ) : (
          data.cases.map((c) => {
            const ss = statusStyle(c.status);
            return (
              <div key={c.id} className="list-row case-list-row">
                <Link to={`/cases/${c.id}`} className="case-list-row-link">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.9rem" }}>{c.title}</strong>
                      {c.case_number && <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "monospace" }}>#{c.case_number}</span>}
                    </div>
                    <div className="meta">{c.client_name} · {c.court || "—"}</div>
                  </div>
                  <span style={{
                    fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.6rem",
                    borderRadius: 5, whiteSpace: "nowrap",
                    background: ss.bg, color: ss.color,
                  }}>{c.status}</span>
                </Link>

                <div className="case-row-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Delete case"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#ef4444" }}
                    disabled={deletingId === c.id}
                    onClick={(e) => handleDelete(c, e)}
                  >
                    {deletingId === c.id ? <span className="spinner" /> : "✕ Delete"}
                  </button>
                </div>
              </div>
            );
          })
        )}

        <Pagination page={data.page} totalPages={data.total_pages} onPage={setPage} />
      </div>
    </>
  );
}
