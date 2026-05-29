import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api, formatBytes, formatTime } from "../api/client";
import { Skeleton, RowSkeleton, Pagination, EmptyState } from "../components/ui";

const PAGE_SIZE = 10;

export default function Documents() {
  const [data, setData] = useState({ documents: [], total: 0, page: 1, total_pages: 1 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [actionLock, setActionLock] = useState(false);
  const debounce = useRef(null);

  function load(s, p) {
    setLoading(true);
    api.documents(s, p, PAGE_SIZE).then((r) => {
      setData({ documents: r.documents || [], total: r.total || 0, page: r.page || p, total_pages: r.total_pages || 1 });
    }).catch(() => setData({ documents: [], total: 0, page: 1, total_pages: 1 }))
    .finally(() => setLoading(false));
  }

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(search, 1); }, 300);
    return () => clearTimeout(debounce.current);
  }, [search]);

  useEffect(() => { load(search, page); }, [page]);

  async function handleDelete(id) {
    if (!confirm("Delete this document from S3?")) return;
    if (actionLock) return;
    setActionLock(true);
    setDeleting(id);
    try {
      await api.deleteDocument(id);
      setData((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== id),
        total: prev.total - 1,
      }));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
      setActionLock(false);
    }
  }

  async function handleDownload(id) {
    if (actionLock) return;
    setActionLock(true);
    try {
      const res = await api.downloadDocument(id);
      window.open(res.url, "_blank");
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLock(false);
    }
  }

  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      {actionLock && deleting && (
        <div className="page-loader">
          <span className="spinner" />
          Deleting document…
        </div>
      )}

      <header className="page-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2>Documents</h2>
            <p>PDF documents stored in your workspace</p>
          </div>
          <Link to="/upload" className="btn btn-primary btn-sm">⬆ Upload PDF</Link>
        </div>
      </header>

      <div className="glass" style={{ marginBottom: "1rem" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: "0.9rem" }}>🔍</span>
          <input
            className="input"
            style={{ marginBottom: 0, paddingLeft: "2rem" }}
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="glass">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {loading
              ? <Skeleton width={90} height="0.75rem" />
              : `${data.total} document${data.total !== 1 ? "s" : ""}`
            }
          </div>
        </div>

        {loading ? (
          <RowSkeleton rows={PAGE_SIZE} cols={3} />
        ) : data.documents.length === 0 ? (
          <EmptyState
            icon="📂"
            title="No documents yet"
            subtitle="Upload a PDF to get started"
            action={<Link to="/upload" className="btn btn-primary btn-sm">Upload your first PDF</Link>}
          />
        ) : (
          data.documents.map((doc) => (
            <div key={doc.id} className="list-row doc-row">
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "0.5rem",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem", flexShrink: 0,
                }}>📄</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 500, fontSize: "0.88rem",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    maxWidth: "340px",
                  }} title={doc.filename}>
                    {doc.filename}
                  </div>
                  <div className="meta" style={{ marginTop: "0.1rem", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.3rem" }}>
                    <span>{formatBytes(doc.size_bytes)}</span>
                    <span>·</span>
                    <span>{formatTime(doc.created_at)}</span>
                    {doc.case_id && (
                      <>
                        <span>·</span>
                        <Link to={`/cases/${doc.case_id}`} style={{ color: "var(--accent)", fontSize: "0.73rem" }} onClick={(e) => e.stopPropagation()}>
                          Case
                        </Link>
                      </>
                    )}
                    {doc.doc_type && <span className="badge" style={{ verticalAlign: "middle" }}>{doc.doc_type}</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDownload(doc.id)}
                  disabled={actionLock}
                  title="Download"
                >⬇ Download</button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--danger)" }}
                  disabled={deleting === doc.id || actionLock}
                  onClick={() => handleDelete(doc.id)}
                  title="Delete from S3"
                >
                  {deleting === doc.id ? <span className="spinner" /> : "✕"}
                </button>
              </div>
            </div>
          ))
        )}

        <Pagination page={data.page} totalPages={data.total_pages} onPage={setPage} />
      </div>
    </>
  );
}
