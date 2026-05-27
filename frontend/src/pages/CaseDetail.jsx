import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatTime } from "../api/client";
import CaseChatPanel from "../components/CaseChatPanel";

export default function CaseDetail() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  function load() {
    api.getCase(id).then(setCaseData);
  }

  useEffect(() => { load(); }, [id]);

  async function uploadDoc(e) {
    e.preventDefault();
    if (!file) return;
    await api.uploadCaseDoc(id, file);
    setFile(null);
    load();
  }

  async function generateBrief() {
    setLoading(true);
    try {
      await api.caseBrief(id, file);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    await api.addNote(id, note);
    setNote("");
    load();
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

  const brief = caseData.brief;

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
            {["overview", "brief", "documents", "notes", "timeline"].map((t) => (
              <button key={t} type="button" className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="glass">
              <h4 style={{ marginBottom: "0.5rem" }}>AI Suggested Actions</h4>
              <ul style={{ paddingLeft: "1.2rem", color: "var(--muted)", fontSize: "0.88rem" }}>
                {(caseData.suggested_actions || []).map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {tab === "brief" && (
            <div className="glass">
              <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={generateBrief}>
                {loading ? "Generating…" : "Generate AI Brief"}
              </button>
              {brief ? (
                <div style={{ marginTop: "1rem" }}>
                  {[
                    ["Overview", brief.case_overview || brief.summary],
                    ["Legal Issues", (brief.legal_issues || brief.key_legal_issues || []).join?.(" · ") || brief.legal_issues],
                    ["Final Verdict", brief.final_verdict],
                    ["Takeaways", (brief.key_takeaways || []).map?.((t) => `• ${t}`).join?.("\n")],
                    ["Simple Explanation", brief.simplified_explanation],
                  ].map(([title, val]) => val && (
                    <div key={title} className="brief-section">
                      <h4>{title}</h4>
                      <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{Array.isArray(val) ? val.join(", ") : val}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="meta" style={{ marginTop: "1rem" }}>No brief generated yet</p>}
            </div>
          )}

          {tab === "documents" && (
            <div className="glass">
              <form onSubmit={uploadDoc} style={{ marginBottom: "1rem" }}>
                <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0])} />
                <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }} disabled={!file}>Upload PDF</button>
              </form>
              {(caseData.documents || []).map((d) => (
                <div key={d.id} className="list-row">
                  <strong>{d.filename}</strong>
                  <span className="meta">{formatTime(d.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "notes" && (
            <div className="glass">
              <form onSubmit={addNote}>
                <textarea className="textarea" placeholder="Legal strategy, hearing prep…" value={note} onChange={(e) => setNote(e.target.value)} />
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

          {tab === "timeline" && (
            <div className="glass">
              {(caseData.timeline || []).length ? caseData.timeline.map((e) => (
                <div key={e.id} className="list-row">
                  <div>
                    <span className="badge">{e.event_type}</span>
                    <strong style={{ marginLeft: "0.5rem" }}>{e.event_date}</strong>
                    <p className="meta">{e.description}</p>
                  </div>
                </div>
              )) : <p className="meta">No timeline events</p>}
            </div>
          )}
        </div>

        <CaseChatPanel caseId={id} />
      </div>
    </>
  );
}
