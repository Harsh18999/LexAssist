import { useState } from "react";
import { api } from "../api/client";

export default function Brief() {
  const [file, setFile] = useState(null);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);

  async function generate(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      setBrief(await api.generateBrief(file));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function pdf() {
    const blob = await api.downloadBriefPdf(file);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "case_brief.pdf";
    a.click();
  }

  const sections = brief ? [
    ["Case", brief.case_title],
    ["Court", brief.court],
    ["Overview", brief.case_overview || brief.summary],
    ["Issues", (brief.legal_issues || brief.key_legal_issues || []).join?.(", ")],
    ["Verdict", brief.final_verdict],
    ["Takeaways", (brief.key_takeaways || []).join?.(" · ")],
  ] : [];

  return (
    <>
      <header className="page-head">
        <h2>AI Case Briefs</h2>
        <p>Structured legal intelligence from judgments</p>
      </header>
      <form className="glass" onSubmit={generate}>
        <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0])} />
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button type="submit" className="btn btn-primary" disabled={!file || loading}>{loading ? "Generating…" : "Generate"}</button>
          {brief && <button type="button" className="btn btn-ghost" onClick={pdf}>Export PDF</button>}
        </div>
      </form>
      {brief && (
        <div className="glass">
          {sections.map(([t, v]) => v && (
            <div key={t} className="brief-section"><h4>{t}</h4><p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{v}</p></div>
          ))}
        </div>
      )}
    </>
  );
}
