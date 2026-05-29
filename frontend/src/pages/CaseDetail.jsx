import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatBytes, formatTime } from "../api/client";
import CaseChatPanel from "../components/CaseChatPanel";

export default function CaseDetail() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState("");
  const [uploadState, setUploadState] = useState({ progress: 0, uploading: false, error: null });
  const inputRef = useRef(null);

  useEffect(() => {
    api.getCase(id).then(setCaseData);
  }, [id]);

  async function uploadDoc(file) {
    if (!file) return;
    setUploadState({ progress: 0, uploading: true, error: null });
    try {
      const newDoc = await api.uploadCaseDoc(id, file, (pct) =>
        setUploadState((s) => ({ ...s, progress: pct }))
      );
      setUploadState({ progress: 100, uploading: false, error: null });
      // Optimistic update — append new doc without full re-fetch
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
    // Optimistic update — prepend new note without full re-fetch
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
      // Optimistic update — remove from local state
      setCaseData((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((d) => d.id !== docId),
      }));
    } catch (e) {
      alert(e.message);
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
      <header className="page-head">
        <Link to="/cases" className="meta">← Cases</Link>
        <h2>{caseData.title}</h2>
        <p>{caseData.client_name} · {caseData.court || "Court not set"}</p>
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
              {/* Upload area */}
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

              {/* Progress */}
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

              {/* Document list */}
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
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDownload(d.id)}
                          title="Download"
                        >
                          ⬇
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "#dc2626" }}
                          onClick={() => handleDelete(d.id)}
                          title="Delete"
                        >
                          ✕
                        </button>
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
    </>
  );
}
