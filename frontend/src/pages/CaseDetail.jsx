import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatBytes, formatTime } from "../api/client";
import { RowSkeleton, Skeleton } from "../components/ui";

const CASE_FIELDS = [
  ["case_number", "Case Number"],
  ["court", "Court"],
  ["case_type", "Case Type"],
  ["filing_date", "Filing Date"],
  ["judgment_date", "Judgment Date"],
  ["petitioner", "Petitioner"],
  ["respondent", "Respondent"],
  ["judges", "Judge(s)"],
  ["status", "Status"],
  ["acts_involved", "Acts Involved"],
  ["constitutional_articles", "Constitutional Articles"],
  ["hearing_date", "Next Hearing"],
  ["advocate", "Advocate"],
];

const STATUS_OPTIONS = ["Active", "Closed", "Pending", "Stayed"];

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState("");
  const [uploadState, setUploadState] = useState({ progress: 0, uploading: false, error: null });
  const [docStatuses, setDocStatuses] = useState({}); // docId -> { status, error }
  const [deletingDocId, setDeletingDocId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const statusCtrlsRef = useRef({});

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getCase(id).then((c) => {
      setCaseData(c);
      setEditForm({
        title: c.title || "",
        case_number: c.case_number || "",
        court: c.court || "",
        case_type: c.case_type || "",
        status: c.status || "Active",
        filing_date: c.filing_date || "",
        judgment_date: c.judgment_date || "",
        petitioner: c.petitioner || "",
        respondent: c.respondent || "",
        judges: c.judges || "",
        acts_involved: c.acts_involved || "",
        constitutional_articles: c.constitutional_articles || "",
        hearing_date: c.hearing_date || "",
        advocate: c.advocate || "",
        client_id: c.client_id || "",
      });
    });
  }, [id]);

  async function uploadDoc(file) {
    if (!file || uploadState.uploading) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadState({ progress: 0, uploading: false, error: "Only PDF files are allowed." });
      return;
    }
    setUploadState({ progress: 0, uploading: true, error: null });
    let newDoc;
    try {
      newDoc = await api.uploadCaseDoc(id, file, (pct) =>
        setUploadState((s) => ({ ...s, progress: pct }))
      );
      setUploadState({ progress: 100, uploading: false, error: null });
      setCaseData((prev) => ({
        ...prev,
        documents: [newDoc, ...(prev.documents || [])],
      }));
      // Start polling processing status for this doc
      setDocStatuses((prev) => ({ ...prev, [newDoc.id]: { status: "pending" } }));
      const ctrl = api.documentStatus(
        newDoc.id,
        (evt) => setDocStatuses((prev) => ({ ...prev, [newDoc.id]: { status: evt.status, error: evt.error } })),
        (evt) => setDocStatuses((prev) => ({ ...prev, [newDoc.id]: { status: evt?.status || "completed", error: evt?.error } }))
      );
      statusCtrlsRef.current[newDoc.id] = ctrl;
    } catch (err) {
      setUploadState({ progress: 0, uploading: false, error: err.message });
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    const newNote = await api.addNote(id, note);
    setNote("");
    setCaseData((prev) => ({
      ...prev,
      notes: [newNote, ...(prev.notes || [])],
    }));
  }

  async function handleView(docId) {
    try {
      const res = await api.downloadDocument(docId);
      window.open(res.url, "_blank");
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDownload(docId) {
    try {
      const res = await api.downloadDocument(docId);
      window.open(res.url, "_blank");
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDelete(docId) {
    if (!confirm("Delete this document from S3 and database?")) return;
    setDeletingDocId(docId);
    try {
      await api.deleteDocument(docId);
      setCaseData((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((d) => d.id !== docId),
      }));
      setDocStatuses((prev) => { const n = { ...prev }; delete n[docId]; return n; });
      statusCtrlsRef.current[docId]?.abort();
      delete statusCtrlsRef.current[docId];
    } catch (e) {
      alert(e.message);
    } finally {
      setDeletingDocId(null);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editSubmitting) return;
    setEditSubmitting(true);
    try {
      const updated = await api.updateCase(id, editForm);
      setCaseData((prev) => ({ ...prev, ...updated }));
      setShowEdit(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteCase() {
    if (!confirm(`Delete case "${caseData.title}"? This will also remove notes and timeline events.`)) return;
    setDeleting(true);
    try {
      await api.deleteCase(id);
      navigate("/cases");
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  // Drag-drop handlers
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = Array.from(e.dataTransfer.files).find((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (f) uploadDoc(f);
  }, [id, uploadState.uploading]);

  if (!caseData) return (
    <>
      <header className="page-head">
        <Skeleton width={80} height="0.75rem" style={{ marginBottom: "0.5rem" }} />
        <Skeleton width={240} height="1.4rem" style={{ marginBottom: "0.3rem" }} />
        <Skeleton width={160} height="0.8rem" />
      </header>
      <div className="case-layout">
        <div>
          <div className="glass" style={{ marginBottom: "1rem" }}>
            <RowSkeleton rows={6} cols={2} height="0.85rem" />
          </div>
          <div className="glass"><RowSkeleton rows={3} cols={2} /></div>
        </div>
        <div className="glass" style={{ minHeight: 400 }}>
          <Skeleton height="2.5rem" style={{ marginBottom: "0.75rem" }} />
          <RowSkeleton rows={5} cols={1} height="3rem" />
        </div>
      </div>
    </>
  );

  const info = [
    ["Case Number", caseData.case_number],
    ["Court", caseData.court],
    ["Filing Date", caseData.filing_date],
    ["Judgment Date", caseData.judgment_date],
    ["Case Type", caseData.case_type],
    ["Petitioner", caseData.petitioner],
    ["Respondent", caseData.respondent],
    ["Judge(s)", caseData.judges],
    ["Status", caseData.status],
    ["Acts", caseData.acts_involved],
    ["Articles", caseData.constitutional_articles],
    ["Hearing", caseData.hearing_date],
    ["Advocate", caseData.advocate],
  ];

  return (
    <>
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(2px);
        }
        .modal-box {
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 0.9rem; padding: 1.5rem;
          width: min(600px, calc(100vw - 2rem));
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
          animation: modalIn 0.18s ease;
        }
        @keyframes modalIn { from { opacity:0; transform: scale(0.96) translateY(8px); } to { opacity:1; transform:none; } }
      `}</style>

      <header className="page-head">
        <Link to="/cases" className="meta">← Cases</Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.1rem" }}>{caseData.title}</h2>
            <p>{caseData.client_name} · {caseData.court || "Court not set"}</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: "0.82rem" }}
              onClick={() => setShowEdit(true)}
            >
              ✏ Edit Case
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: "0.82rem", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
              onClick={handleDeleteCase}
              disabled={deleting}
            >
              {deleting ? <><span className="spinner" /> Deleting…</> : "🗑 Delete Case"}
            </button>
          </div>
        </div>
      </header>

      <div className="case-layout">
        <div>
          <div className="info-grid glass" style={{ marginBottom: "1rem" }}>
            {info.map(([k, v]) => (
              <div key={k} className="info-item">
                <div className="k">{k}</div>
                <div className="v">{v || "—"}</div>
              </div>
            ))}
          </div>

          <div className="tabs">
            {["overview", "documents", "notes", "timeline"].map((t) => (
              <button
                key={t}
                type="button"
                className={`tab${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === "documents" && caseData.documents?.length > 0 && (
                  <span className="badge" style={{ marginLeft: "0.4rem", fontSize: "0.65rem" }}>
                    {caseData.documents.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Overview */}
          {tab === "overview" && (
            <div className="glass">
              <h4 style={{ marginBottom: "0.5rem" }}>Case Summary</h4>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div className="info-item">
                  <div className="k">Status</div>
                  <div className="v">
                    <span className={`badge ${caseData.status === "Active" ? "badge-green" : ""}`}>
                      {caseData.status || "Active"}
                    </span>
                  </div>
                </div>
                <div className="info-item">
                  <div className="k">Documents</div>
                  <div className="v">{caseData.documents?.length || 0} uploaded</div>
                </div>
                <div className="info-item">
                  <div className="k">Notes</div>
                  <div className="v">{caseData.notes?.length || 0} notes</div>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {tab === "documents" && (
            <div className="glass">
              <div
                className={`case-upload-zone${dragging ? " dragging" : ""}${uploadState.uploading ? " disabled" : ""}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !uploadState.uploading && inputRef.current?.click()}
                style={{ pointerEvents: uploadState.uploading ? "none" : "auto" }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => uploadDoc(e.target.files?.[0])}
                />
                <span style={{ fontSize: "1.5rem" }}>📄</span>
                <span style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
                  {uploadState.uploading ? "Uploading…" : dragging ? "Drop PDF here" : "Click or drag & drop a PDF"}
                </span>
              </div>

              {uploadState.uploading && (
                <div style={{ margin: "0.75rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                    <span>Uploading to S3…</span>
                    <span>{uploadState.progress}%</span>
                  </div>
                  <div className="upload-progress-bar-wrap" style={{ marginBottom: 0 }}>
                    <div className="upload-progress-bar" style={{ width: `${uploadState.progress}%` }} />
                  </div>
                </div>
              )}
              {uploadState.error && (
                <div className="upload-error" style={{ margin: "0.5rem 0" }}>{uploadState.error}</div>
              )}

              {(caseData.documents || []).length === 0 ? (
                <p className="meta" style={{ marginTop: "1rem" }}>No documents uploaded yet.</p>
              ) : (
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {(caseData.documents || []).map((d) => {
                    const ds = docStatuses[d.id] || { status: d.status || "completed" };
                    const isDel = deletingDocId === d.id;
                    return (
                      <div key={d.id} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span style={{ fontSize: "1.1rem" }}>📄</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.filename}</div>
                            <div className="meta">{formatBytes(d.size_bytes)} · {formatTime(d.created_at)}</div>
                          </div>
                          {/* Processing status pill */}
                          {ds.status === "pending"    && <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "1rem", background: "rgba(234,179,8,0.12)", color: "#ca8a04", fontWeight: 700, flexShrink: 0 }}>⏳ Pending</span>}
                          {ds.status === "processing" && <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "1rem", background: "rgba(37,99,235,0.1)", color: "var(--accent)", fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: "0.3rem" }}><span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />Indexing</span>}
                          {ds.status === "completed"  && <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "1rem", background: "rgba(22,163,74,0.1)", color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓ Ready</span>}
                          {ds.status === "error"      && <span title={ds.error} style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "1rem", background: "rgba(239,68,68,0.1)", color: "#dc2626", fontWeight: 700, flexShrink: 0 }}>⚠ Error</span>}

                          <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleView(d.id)} title="View PDF" disabled={isDel}>👁</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(d.id)} title="Download" disabled={isDel}>⬇</button>
                            {ds.status === "completed" && (
                              <Link to={`/documents/${d.id}/ai`} className="btn btn-ghost btn-sm" title="Ask AI about this doc" style={{ display: "inline-flex", alignItems: "center" }}>🤖</Link>
                            )}
                            <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => handleDelete(d.id)} disabled={isDel} title="Delete">
                              {isDel ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : "✕"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {tab === "notes" && (
            <div className="glass">
              <form onSubmit={addNote}>
                <textarea
                  className="textarea"
                  placeholder="Legal strategy, hearing prep, key observations…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm">Add Note</button>
              </form>
              {(caseData.notes || []).map((n) => (
                <div key={n.id} className="list-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                  <p style={{ fontSize: "0.88rem" }}>{n.content}</p>
                  <span className="meta">{formatTime(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          {tab === "timeline" && (
            <div className="glass">
              {(caseData.timeline || []).length ? (
                caseData.timeline.map((e) => (
                  <div key={e.id} className="list-row">
                    <div>
                      <span className="badge">{e.event_type}</span>
                      <strong style={{ marginLeft: "0.5rem" }}>{e.event_date}</strong>
                      <p className="meta">{e.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="meta">No timeline events</p>
              )}
            </div>
          )}
        </div>

        {/* Research CTA */}
        <div className="glass" style={{ marginTop: "0.85rem", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.15rem" }}>🤖 AI Research for this case</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Use the Research AI to query case documents + all legal sources</div>
          </div>
          <Link
            to="/research"
            className="btn btn-primary btn-sm"
            style={{ whiteSpace: "nowrap" }}
          >
            Open Research AI
          </Link>
        </div>
      </div>

      {/* Edit Case Modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Edit Case</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="grid-2">
                <div style={{ gridColumn: "span 2" }}>
                  <label className="label">Title *</label>
                  <input className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Case Number</label>
                  <input className="input" value={editForm.case_number} onChange={(e) => setEditForm({ ...editForm, case_number: e.target.value })} />
                </div>
                <div>
                  <label className="label">Court</label>
                  <input className="input" value={editForm.court} onChange={(e) => setEditForm({ ...editForm, court: e.target.value })} />
                </div>
                <div>
                  <label className="label">Case Type</label>
                  <input className="input" value={editForm.case_type} onChange={(e) => setEditForm({ ...editForm, case_type: e.target.value })} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Filing Date</label>
                  <input className="input" value={editForm.filing_date} onChange={(e) => setEditForm({ ...editForm, filing_date: e.target.value })} placeholder="YYYY-MM-DD" />
                </div>
                <div>
                  <label className="label">Judgment Date</label>
                  <input className="input" value={editForm.judgment_date} onChange={(e) => setEditForm({ ...editForm, judgment_date: e.target.value })} placeholder="YYYY-MM-DD" />
                </div>
                <div>
                  <label className="label">Next Hearing</label>
                  <input className="input" value={editForm.hearing_date} onChange={(e) => setEditForm({ ...editForm, hearing_date: e.target.value })} placeholder="YYYY-MM-DD" />
                </div>
                <div>
                  <label className="label">Advocate</label>
                  <input className="input" value={editForm.advocate} onChange={(e) => setEditForm({ ...editForm, advocate: e.target.value })} />
                </div>
                <div>
                  <label className="label">Petitioner</label>
                  <input className="input" value={editForm.petitioner} onChange={(e) => setEditForm({ ...editForm, petitioner: e.target.value })} />
                </div>
                <div>
                  <label className="label">Respondent</label>
                  <input className="input" value={editForm.respondent} onChange={(e) => setEditForm({ ...editForm, respondent: e.target.value })} />
                </div>
                <div>
                  <label className="label">Judge(s)</label>
                  <input className="input" value={editForm.judges} onChange={(e) => setEditForm({ ...editForm, judges: e.target.value })} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label className="label">Acts Involved</label>
                  <input className="input" value={editForm.acts_involved} onChange={(e) => setEditForm({ ...editForm, acts_involved: e.target.value })} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label className="label">Constitutional Articles</label>
                  <input className="input" value={editForm.constitutional_articles} onChange={(e) => setEditForm({ ...editForm, constitutional_articles: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? <><span className="spinner" /> Saving…</> : "Save Changes"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
