import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatBytes, formatTime } from "../api/client";
import CaseChatPanel from "../components/CaseChatPanel";

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
  const inputRef = useRef(null);

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
    if (!file) return;
    setUploadState({ progress: 0, uploading: true, error: null });
    try {
      const newDoc = await api.uploadCaseDoc(id, file, (pct) =>
        setUploadState((s) => ({ ...s, progress: pct }))
      );
      setUploadState({ progress: 100, uploading: false, error: null });
      setCaseData((prev) => ({
        ...prev,
        documents: [newDoc, ...(prev.documents || [])],
      }));
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

  async function handleDownload(docId) {
    try {
      const res = await api.downloadDocument(docId);
      window.open(res.url, "_blank");
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDelete(docId) {
    if (!confirm("Delete this document from S3?")) return;
    try {
      await api.deleteDocument(docId);
      setCaseData((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((d) => d.id !== docId),
      }));
    } catch (e) {
      alert(e.message);
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

  if (!caseData) return <div className="empty">Loading case…</div>;

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
                className="case-upload-zone"
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => uploadDoc(e.target.files?.[0])}
                />
                <span style={{ fontSize: "1.5rem" }}>📎</span>
                <span style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
                  Click to upload a PDF document
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
                <div style={{ marginTop: "1rem" }}>
                  {(caseData.documents || []).map((d) => (
                    <div key={d.id} className="list-row">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span style={{ fontSize: "1.2rem" }}>📄</span>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: "0.88rem" }}>{d.filename}</div>
                          <div className="meta">{formatBytes(d.size_bytes)} · {formatTime(d.created_at)}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(d.id)} title="Download">⬇</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => handleDelete(d.id)} title="Delete">✕</button>
                      </div>
                    </div>
                  ))}
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

        <CaseChatPanel caseId={id} caseTitle={caseData.title} />
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
