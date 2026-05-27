import { useEffect, useState } from "react";
import { api, formatTime, formatCategory } from "../api/client";

export default function KnowledgeBase() {
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .knowledgeBase(search)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  async function showPreview(path) {
    try {
      const p = await api.preview(path);
      setPreview(p);
    } catch (e) {
      alert(e.message);
    }
  }

  const docs = data?.documents || [];
  const indexActive = data?.index_status === "Active";

  return (
    <>
      <header className="page-header">
        <h2>Legal Knowledge Base</h2>
        <p>Your uploaded judgments and statutes</p>
      </header>

      <div className="search-row">
        <input
          className="input"
          placeholder="Search documents by filename…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className={`badge ${indexActive ? "badge-active" : "badge-inactive"}`}>
          Index: {data?.index_status || "—"}
        </span>
      </div>

      {loading ? (
        <p className="empty">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="empty">No PDF documents found in Data folder.</p>
      ) : (
        <div className="grid-2">
          <div className="card">
            <h3>Documents ({docs.length})</h3>
            {docs.map((doc) => (
              <div key={doc.path} className="doc-row">
                <strong>{doc.filename}</strong>
                <div className="meta">
                  <span className="badge badge-category">
                    {formatCategory(doc.category)}
                  </span>
                  {" · "}
                  {doc.size_label} · {formatTime(doc.upload_date)}
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => showPreview(doc.path)}
                >
                  Preview
                </button>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Document Preview</h3>
            {!preview ? (
              <p className="empty">Select a document to preview.</p>
            ) : (
              <>
                <p>
                  <strong>{preview.filename}</strong>
                </p>
                <p className="meta">
                  {formatCategory(preview.category)} · {preview.size_label} ·{" "}
                  {preview.page_count} pages · {formatTime(preview.upload_date)}
                </p>
                <h4 style={{ marginTop: "1rem" }}>Extracted snippet</h4>
                <div className="preview-box">{preview.snippet}</div>
                <h4 style={{ marginTop: "1rem" }}>First page</h4>
                <div className="preview-box">{preview.first_page_text}</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
